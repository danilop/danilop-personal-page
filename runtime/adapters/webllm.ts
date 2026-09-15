import type { ModelRuntime, ModelDescriptor } from "../contracts";
const app = (m: ModelDescriptor) => ({
  model_list: [
    {
      model_id: m.id,
      model: m.model,
      model_lib: m.modelLib,
      integrity: m.integrity,
      required_features: m.requiredFeatures,
      overrides: { context_window_size: 2048 },
    },
  ],
});
export const webllm: ModelRuntime = {
  id: "webllm",
  version: "0.2.85",
  locality: "local",
  formats: ["mlc"],
  async probe(model) {
    const gpu = (navigator as any).gpu;
    if (!gpu)
      return {
        supported: false,
        reason:
          "This browser does not provide WebGPU. The written example remains available.",
      };
    const adapter = await gpu.requestAdapter();
    if (!adapter)
      return { supported: false, reason: "No compatible GPU is available." };
    const missing = model.requiredFeatures.filter(
      (f) => !adapter.features.has(f),
    );
    return {
      supported: missing.length === 0,
      reason: missing.length
        ? "The GPU is missing " + missing.join(", ")
        : undefined,
    };
  },
  async load(model, progress, signal) {
    const api = await import("@mlc-ai/web-llm");
    const worker = new Worker(new URL("../model.worker.ts", import.meta.url), {
      type: "module",
    });
    const abort = () => worker.terminate();
    signal.addEventListener("abort", abort, { once: true });
    let engine;
    try {
      engine = await Promise.race([
        api.CreateWebWorkerMLCEngine(worker, model.id, {
          appConfig: app(model),
          initProgressCallback: (p) => progress(p.text),
        }),
        new Promise<never>((_, reject) =>
          signal.addEventListener(
            "abort",
            () => reject(new DOMException("Cancelled", "AbortError")),
            { once: true },
          ),
        ),
      ]);
    } catch (e) {
      worker.terminate();
      throw e;
    }
    signal.removeEventListener("abort", abort);
    return {
      async run(prompt, onToken, runSignal) {
        const stop = () => engine.interruptGenerate();
        runSignal.addEventListener("abort", stop, { once: true });
        let text = "";
        try {
          const stream = await engine.chat.completions.create({
            messages: [{ role: "user", content: prompt }],
            stream: true,
            max_tokens: 256,
            temperature: 0.6,
          });
          for await (const chunk of stream) {
            if (runSignal.aborted) break;
            text += chunk.choices[0]?.delta.content ?? "";
            onToken(text);
          }
          return text;
        } finally {
          runSignal.removeEventListener("abort", stop);
        }
      },
      stop() {
        engine.interruptGenerate();
      },
      reset() {
        return engine.resetChat();
      },
      async dispose() {
        try {
          await engine.unload();
        } finally {
          worker.terminate();
        }
      },
    };
  },
  async clear(model) {
    const api = await import("@mlc-ai/web-llm");
    await api.deleteModelAllInfoInCache(model.id, app(model));
  },
};
