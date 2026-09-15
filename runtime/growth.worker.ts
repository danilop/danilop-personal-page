import { experiments, validateExperiment } from "./experiment-registry";
self.onmessage = async (event) => {
  try {
    const definition = experiments[event.data.module];
    if (!definition) throw Error("Unknown experiment");
    const result = await definition.run(
      validateExperiment(definition, event.data.input),
    );
    self.postMessage({ result });
  } catch (error) {
    self.postMessage({ error: String(error) });
  }
};
