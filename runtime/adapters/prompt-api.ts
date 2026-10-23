import type { BuiltinModel, ModelRuntime } from "../contracts";
import { jsonAgentChat, stepSchema, toolGuide } from "./json-agent-chat";

type Availability =
  "unavailable" | "downloadable" | "downloading" | "available";
type PromptOptions = { signal?: AbortSignal; responseConstraint?: object };
type LanguageModelSession = {
  prompt(input: string, options?: PromptOptions): Promise<string>;
  promptStreaming(
    input: string,
    options?: PromptOptions,
  ): AsyncIterable<string>;
  clone(): Promise<LanguageModelSession>;
  destroy(): void;
};
type LanguageModelApi = {
  availability(options: object): Promise<Availability>;
  create(options: object): Promise<LanguageModelSession>;
};
const api = () =>
  (globalThis as { LanguageModel?: LanguageModelApi }).LanguageModel;
const languages = (model: BuiltinModel) => ({
  expectedInputs: [{ type: "text", languages: model.languages }],
  expectedOutputs: [{ type: "text", languages: model.languages }],
});
/** Built-in models are unversioned; records name the browser instead. */
function browserVersion() {
  const ua = typeof navigator === "undefined" ? "" : navigator.userAgent;
  const match = /(Edg|Chrome)\/(\d+)/.exec(ua);
  return match
    ? `${match[1] === "Edg" ? "Edge" : "Chrome"} ${match[2]}`
    : "unknown browser";
}

export const promptApi: ModelRuntime = {
  id: "prompt-api",
  version: `browser-provided (unversioned), ${browserVersion()}`,
  locality: "local",
  formats: ["builtin"],
  async probe(descriptor) {
    const lm = api();
    if (!lm)
      return {
        supported: false,
        reason: "This browser does not provide a built-in language model.",
      };
    const state = await lm.availability(languages(descriptor as BuiltinModel));
    if (state === "unavailable")
      return {
        supported: false,
        reason: "The browser's built-in model is not available on this device.",
      };
    return { supported: true, download: state !== "available" };
  },
  async load(descriptor, progress, signal) {
    const model = descriptor as BuiltinModel;
    const lm = api()!;
    const base = await lm.create({
      ...languages(model),
      signal,
      monitor(m: EventTarget) {
        m.addEventListener("downloadprogress", (event) => {
          const loaded = (event as Event & { loaded: number }).loaded;
          progress(
            `Downloading the browser's model… ${Math.round(loaded * 100)}%`,
          );
        });
      },
    });
    let session = await base.clone();
    return {
      async run(prompt, onToken, runSignal) {
        let text = "";
        for await (const chunk of session.promptStreaming(prompt, {
          signal: runSignal,
        })) {
          text += chunk;
          onToken(text);
        }
        return text;
      },
      stop() {
        /* Generation stops through the run's AbortSignal. */
      },
      async reset() {
        session.destroy();
        session = await base.clone();
      },
      async dispose() {
        session.destroy();
        base.destroy();
      },
      async startAgentChat(system, tools) {
        const chat = await lm.create({
          ...languages(model),
          initialPrompts: [
            { role: "system", content: system + toolGuide(tools) },
          ],
        });
        const responseConstraint = stepSchema(tools);
        return jsonAgentChat(
          (text, signal) => chat.prompt(text, { signal, responseConstraint }),
          tools,
          async () => chat.destroy(),
        );
      },
    };
  },
  async clear() {
    /* The browser manages its own model; there is nothing to delete here. */
  },
};
