import {
  downloadRecord,
  modelSummary,
  type ModelDescriptor,
  type ModelSession,
} from "./contracts";
import { modelRuntimes as runtimes } from "./model-registry";
import models from "../publishing/models.json";

export function mountModels() {
  for (const root of document.querySelectorAll<HTMLElement>(
    ".model-experiment",
  )) {
    // One model id, or several in preference order: the first this browser
    // supports is used.
    const candidates = (root.dataset.model ?? "")
      .split(/\s+/)
      .map((id) => models.models.find((m) => m.id === id) as ModelDescriptor)
      .filter(Boolean);
    const output = root.querySelector("output")!;
    if (!candidates.length) {
      output.textContent = "This model is not registered.";
      root.querySelectorAll("button").forEach((b) => (b.disabled = true));
      continue;
    }
    let model = candidates[0];
    let runtime = runtimes[model.runtime];
    let session: ModelSession | undefined;
    let loading: AbortController | undefined;
    let running: AbortController | undefined;
    let record: import("./contracts").RecordedRun | undefined;
    let generation = 0;
    let runEpoch = 0;
    const fallback = output.textContent;
    const info = root.querySelector(".model-info")!;
    info.textContent =
      candidates.length === 1
        ? modelSummary(model)
        : `Uses the first available of: ${candidates.map((m) => m.label ?? m.id).join("; ")}.`;
    const button = (action: string) =>
      root.querySelector<HTMLButtonElement>(`[data-action=${action}]`)!;
    button("load-model").addEventListener("click", () => {
      void (async () => {
        if (loading || session) return;
        const epoch = ++generation;
        loading = new AbortController();
        button("load-model").disabled = true;
        try {
          const reasons: string[] = [];
          let chosen: ModelDescriptor | undefined;
          for (const candidate of candidates) {
            const result = await runtimes[candidate.runtime].probe(candidate);
            if (result.supported) {
              chosen = candidate;
              break;
            }
            reasons.push(result.reason ?? "Not supported.");
          }
          if (!chosen) throw Error(reasons.join(" "));
          model = chosen;
          runtime = runtimes[model.runtime];
          if (candidates.length > 1) info.textContent = modelSummary(model);
          output.textContent = "Loading the model…";
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
      })().catch((error: unknown) => {
        output.textContent =
          error instanceof Error ? error.message : String(error);
      });
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
    button("cancel-model").addEventListener("click", () => {
      void (async () => {
        await unload();
        output.textContent = "Model unloaded.";
      })().catch((error: unknown) => {
        output.textContent =
          error instanceof Error ? error.message : String(error);
      });
    });
    button("clear-model").addEventListener("click", () => {
      void (async () => {
        try {
          await unload();
          await runtime.clear(model);
          output.textContent = "Downloaded model cleared.";
        } catch (e) {
          output.textContent = String(e);
        }
      })().catch((error: unknown) => {
        output.textContent =
          error instanceof Error ? error.message : String(error);
      });
    });
    button("generate").addEventListener("click", () => {
      void (async () => {
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
            input: {
              prompt,
              model: model.id,
              ...("revision" in model ? { revision: model.revision } : {}),
            },
            output: result,
            capturedAt: new Date().toISOString(),
          };
        } catch (e) {
          output.textContent = String(e);
        } finally {
          running = undefined;
          button("generate").disabled = false;
        }
      })().catch((error: unknown) => {
        output.textContent =
          error instanceof Error ? error.message : String(error);
      });
    });
    button("stop-model").addEventListener("click", () => {
      running?.abort();
      session?.stop();
    });
    button("reset-model").addEventListener("click", () => {
      void (async () => {
        runEpoch++;
        running?.abort();
        session?.stop();
        if (session) await session.reset();
        record = undefined;
        output.textContent = fallback;
      })().catch((error: unknown) => {
        output.textContent =
          error instanceof Error ? error.message : String(error);
      });
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
