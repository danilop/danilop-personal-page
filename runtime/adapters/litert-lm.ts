import type { LiteRtModel, ModelRuntime } from "../contracts";
import litertPackage from "@litert-lm/core/package.json";
import type { Tool } from "@litert-lm/core";

/** Model files persist here until the reader clears them. */
const CACHE = "notes-models-v1";
type Gpu = {
  requestAdapter(): Promise<{ features: Set<string> } | null>;
};
type Schema = {
  type?: string;
  description?: string;
  properties?: Record<string, Schema>;
  required?: string[];
  items?: Schema;
  enum?: string[];
};

/** LiteRT-LM accepts a JSON Schema subset; drop keywords it does not know. */
function toLiteRtSchema(schema: Schema): Schema {
  return {
    ...(schema.type ? { type: schema.type } : {}),
    ...(schema.description ? { description: schema.description } : {}),
    ...(schema.enum ? { enum: schema.enum } : {}),
    ...(schema.items ? { items: toLiteRtSchema(schema.items) } : {}),
    ...(schema.required?.length ? { required: schema.required } : {}),
    ...(schema.properties
      ? {
          properties: Object.fromEntries(
            Object.entries(schema.properties).map(([k, v]) => [
              k,
              toLiteRtSchema(v),
            ]),
          ),
        }
      : {}),
  };
}

async function cachedModel(
  model: LiteRtModel,
  progress: (text: string) => void,
  signal: AbortSignal,
) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(model.model);
  if (hit?.body) return hit.body;
  const response = await fetch(model.model, { signal });
  if (!response.ok || !response.body)
    throw Error(`The model download failed (HTTP ${response.status}).`);
  let loaded = 0;
  let shown = -1;
  const counted = response.body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        loaded += chunk.byteLength;
        const percent = Math.floor((loaded / model.downloadBytes) * 100);
        if (percent !== shown)
          progress(`Downloading the model… ${(shown = percent)}%`);
        controller.enqueue(chunk);
      },
    }),
  );
  await cache.put(
    model.model,
    new Response(counted, {
      headers: { "content-type": "application/octet-stream" },
    }),
  );
  if (loaded !== model.downloadBytes) {
    await cache.delete(model.model);
    throw Error("The model download was incomplete. Please try again.");
  }
  const stored = await cache.match(model.model);
  if (!stored?.body) throw Error("The browser did not keep the model file.");
  return stored.body;
}

export const litertLm: ModelRuntime = {
  id: "litert-lm",
  version: litertPackage.version,
  locality: "local",
  formats: ["litertlm"],
  async probe(descriptor) {
    const model = descriptor as LiteRtModel;
    const gpu = (navigator as Navigator & { gpu?: Gpu }).gpu;
    if (!gpu)
      return {
        supported: false,
        reason: "This browser does not provide WebGPU.",
      };
    const adapter = await gpu.requestAdapter();
    if (!adapter)
      return { supported: false, reason: "No compatible GPU is available." };
    const missing = model.requiredFeatures.filter(
      (f) => !adapter.features.has(f),
    );
    if (missing.length)
      return {
        supported: false,
        reason: "The GPU is missing " + missing.join(", "),
      };
    if (typeof caches === "undefined")
      return {
        supported: false,
        reason: "This browser cannot store the model.",
      };
    if (await (await caches.open(CACHE)).match(model.model))
      return { supported: true, download: false };
    const { quota = 0, usage = 0 } =
      (await navigator.storage?.estimate?.()) ?? {};
    if (quota - usage < model.downloadBytes * 1.1)
      return {
        supported: false,
        reason: `Not enough free browser storage for the ${(model.downloadBytes / 1e9).toFixed(1)} GB model.`,
      };
    return { supported: true, download: true };
  },
  async load(descriptor, progress, signal) {
    const model = descriptor as LiteRtModel;
    const L = await import("@litert-lm/core");
    const stream = await cachedModel(model, progress, signal);
    signal.throwIfAborted();
    progress("Starting the model…");
    const engine = await L.Engine.create({
      model: stream,
      mainExecutorSettings: { maxNumTokens: 4096 },
    });
    if (signal.aborted) {
      await engine.delete();
      signal.throwIfAborted();
    }
    const sessionConfig = {
      samplerParams: { type: L.SamplerType.GREEDY, temperature: 0 },
      maxOutputTokens: 512,
    };
    const open: { delete(): Promise<void> }[] = [];
    let chat = await engine.createConversation({ sessionConfig });
    return {
      async run(prompt, onToken, runSignal) {
        const stop = () => chat.cancel();
        runSignal.addEventListener("abort", stop, { once: true });
        let text = "";
        try {
          for await (const chunk of chat.sendMessageStreaming(prompt)) {
            for (const part of chunk.content ?? [])
              if (typeof part !== "string" && part.type === "text")
                text += part.text;
            onToken(text);
          }
          return text;
        } finally {
          runSignal.removeEventListener("abort", stop);
        }
      },
      stop() {
        chat.cancel();
      },
      async reset() {
        await chat.delete();
        chat = await engine.createConversation({ sessionConfig });
      },
      async dispose() {
        await Promise.all([chat, ...open].map((c) => c.delete()));
        await engine.delete();
      },
      async startAgentChat(system, tools) {
        const conversation = await engine.createConversation({
          preface: {
            messages: [{ role: "system", content: system }],
            tools: tools.map((t) => ({
              type: "function",
              function: {
                name: t.name,
                description: t.description,
                parameters: toLiteRtSchema(t.inputSchema as Schema),
              },
            })) as Tool[],
          },
          enableConstrainedDecoding: true,
          sessionConfig,
        });
        open.push(conversation);
        return {
          async send(input, sendSignal) {
            const stop = () => conversation.cancel();
            sendSignal.addEventListener("abort", stop, { once: true });
            try {
              const reply = await conversation.sendMessage(
                "user" in input
                  ? input.user
                  : {
                      role: "tool",
                      content: [
                        {
                          type: "tool_response",
                          name: input.toolResult.name,
                          response: input.toolResult.result as never,
                        },
                      ],
                    },
              );
              sendSignal.throwIfAborted();
              const call = reply.tool_calls?.[0]?.function;
              if (call)
                return { call: { name: call.name, input: call.arguments } };
              const content = reply.content;
              return {
                text:
                  typeof content === "string"
                    ? content
                    : (content ?? [])
                        .map((p) => ("text" in p ? String(p.text) : ""))
                        .join(""),
              };
            } finally {
              sendSignal.removeEventListener("abort", stop);
            }
          },
          async dispose() {
            open.splice(open.indexOf(conversation), 1);
            await conversation.delete();
          },
        };
      },
    };
  },
  async clear(descriptor) {
    await (await caches.open(CACHE)).delete((descriptor as LiteRtModel).model);
  },
};
