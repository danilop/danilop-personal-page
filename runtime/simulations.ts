import { downloadRecord } from "./contracts";
import {
  experiments,
  validateExperiment,
  type ExperimentInput,
} from "./experiment-registry";
export function mountSimulations() {
  for (const root of document.querySelectorAll<HTMLElement>(".experiment")) {
    const definition = experiments[root.dataset.experiment!];
    if (!definition) continue;
    const scenarios = JSON.parse(root.dataset.scenarios ?? "{}");
    root
      .querySelector<HTMLSelectElement>("[data-action=scenario]")
      ?.addEventListener("change", (event) => {
        const scenario = scenarios[(event.target as HTMLSelectElement).value];
        if (!scenario) return;
        stop();
        for (const field of definition.fields)
          root.querySelector<HTMLInputElement>(`[name=${field.name}]`)!.value =
            String(scenario.input[field.name]);
      });
    let worker: Worker | undefined;
    let recorded: any;
    const output = root.querySelector("output")!;
    const initialText = output.textContent;
    const results = root.querySelector(".experiment-results")!;
    const stop = () => {
      worker?.terminate();
      worker = undefined;
    };
    const run = root.querySelector<HTMLButtonElement>("[data-action=run]")!;
    run.addEventListener("click", () => {
      stop();
      try {
        const input: ExperimentInput = Object.fromEntries(
          definition.fields.map((f) => [
            f.name,
            Number(
              root.querySelector<HTMLInputElement>(`[name=${f.name}]`)!.value,
            ),
          ]),
        );
        validateExperiment(definition, input);
        worker = new Worker(new URL("./growth.worker.ts", import.meta.url), {
          type: "module",
        });
        output.textContent = "Running…";
        worker.onmessage = (event) => {
          if (event.data.error) {
            output.textContent = event.data.error;
            stop();
            return;
          }
          const values: number[] = event.data.result;
          output.textContent = definition.summary(input, values);
          recorded = {
            runtime: root.dataset.experiment!,
            version: definition.version,
            input,
            output: values,
            capturedAt: new Date().toISOString(),
          };
          const table = document.createElement("table");
          table.innerHTML =
            '<thead><tr><th scope="col">Step</th><th scope="col">Value</th></tr></thead>';
          const body = document.createElement("tbody");
          values.forEach((v, i) => {
            const row = document.createElement("tr");
            for (const value of [String(i), v.toFixed(2)]) {
              const cell = document.createElement("td");
              cell.textContent = value;
              row.append(cell);
            }
            body.append(row);
          });
          table.append(body);
          results.replaceChildren(table);
          stop();
        };
        worker.onerror = () => {
          output.textContent = "The simulation could not run on this device.";
          stop();
        };
        worker.postMessage({
          input,
          module: definition.id,
        });
      } catch (e) {
        output.textContent = String(e);
      }
    });
    root.querySelector("[data-action=stop]")!.addEventListener("click", () => {
      stop();
      output.textContent = "Stopped.";
    });
    root.querySelector("[data-action=reset]")!.addEventListener("click", () => {
      stop();
      recorded = undefined;
      results.replaceChildren();
      output.textContent = initialText;
      for (const field of definition.fields)
        root.querySelector<HTMLInputElement>(`[name=${field.name}]`)!.value =
          String(field.initial);
    });
    root
      .querySelector("[data-action=capture]")!
      .addEventListener("click", () => {
        if (recorded) downloadRecord("simulation-result", recorded);
        else output.textContent = "Run the example before saving a result.";
      });
    window.addEventListener("pagehide", stop, { once: true });
  }
}
