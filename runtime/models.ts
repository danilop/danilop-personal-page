import {
  downloadRecord,
  type ModelRuntime,
  type ModelDescriptor,
  type ModelSession,
} from "./contracts";
import { modelRuntimes as runtimes } from "./model-registry";
import models from "../publishing/models.json";

export function mountModels() {
  for (const root of document.querySelectorAll<HTMLElement>(
    ".model-experiment",
  )) {
    const model = models.models.find((m) => m.id === root.dataset.model) as
      ModelDescriptor | undefined;
    const output = root.querySelector("output")!;
    if (!model) {
      output.textContent = "This model is not registered.";
      root.querySelectorAll("button").forEach((b) => (b.disabled = true));
      continue;
    }
    const runtime = runtimes[model.runtime];
    let session: ModelSession | undefined;
    let loading: AbortController | undefined;
    let running: AbortController | undefined;
    let record: any;
    let generation = 0;
    let runEpoch = 0;
    const fallback = output.textContent;
    root.querySelector(".model-info")!.textContent =
      `${model.id}. Download approximately ${Math.ceil(model.downloadBytes / 1024 / 1024)} MB; estimated GPU memory ${Math.ceil(model.vramMB)} MB.`;
    const button = (action: string) =>
      root.querySelector<HTMLButtonElement>(`[data-action=${action}]`)!;
    button("load-model").addEventListener("click", async () => {
      if (loading || session) return;
      const epoch = ++generation;
      loading = new AbortController();
      button("load-model").disabled = true;
      try {
        const compatible = await runtime.probe(model);
        if (!compatible.supported) throw Error(compatible.reason);
        output.textContent = "Downloading model files…";
        session = await runtime.load(
          model,
          (text) => {
            if (epoch === generation) output.textContent = text;
          },
          loading.signal,
        );
        if (epoch !== generation) {
          await session.dispose();
          session = undefined;
          return;
        }
        output.textContent = "Ready. Enter a prompt to begin.";
      } catch (e) {
        if (epoch === generation) output.textContent = String(e);
      } finally {
        if (epoch === generation) {
          loading = undefined;
          button("load-model").disabled = false;
        }
      }
    });
    const unload = async () => {
      generation++;
      runEpoch++;
      loading?.abort();
      loading = undefined;
      running?.abort();
      running = undefined;
      const previous = session;
      session = undefined;
      if (previous) await previous.dispose();
      button("load-model").disabled = false;
    };
    button("cancel-model").addEventListener("click", async () => {
      await unload();
      output.textContent = "Model unloaded.";
    });
    button("clear-model").addEventListener("click", async () => {
      try {
        await unload();
        await runtime.clear(model);
        output.textContent = "Downloaded model cleared.";
      } catch (e) {
        output.textContent = String(e);
      }
    });
    button("generate").addEventListener("click", async () => {
      if (!session) {
        output.textContent = "Load the model first.";
        return;
      }
      if (running) return;
      const prompt = root.querySelector("textarea")!.value.trim();
      if (!prompt) return;
      const epoch = ++runEpoch;
      running = new AbortController();
      button("generate").disabled = true;
      try {
        const result = await session.run(
          prompt,
          (t) => {
            if (epoch === runEpoch) output.textContent = t;
          },
          running.signal,
        );
        if (epoch !== runEpoch) return;
        record = {
          runtime: runtime.id,
          version: runtime.version,
          input: { prompt, model: model.id, revision: model.revision },
          output: result,
          capturedAt: new Date().toISOString(),
        };
      } catch (e) {
        output.textContent = String(e);
      } finally {
        running = undefined;
        button("generate").disabled = false;
      }
    });
    button("stop-model").addEventListener("click", () => {
      running?.abort();
      session?.stop();
    });
    button("reset-model").addEventListener("click", async () => {
      runEpoch++;
      running?.abort();
      session?.stop();
      if (session) await session.reset();
      record = undefined;
      output.textContent = fallback;
    });
    button("capture-model").addEventListener("click", () => {
      if (record) downloadRecord("model-result", record);
      else output.textContent = "Generate a response before saving a result.";
    });
    window.addEventListener(
      "pagehide",
      () => {
        void unload();
      },
      { once: true },
    );
  }
}
