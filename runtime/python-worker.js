// Loaded as text into a module Worker inside the opaque-origin runner frame.
const base = "https://cdn.jsdelivr.net/pyodide/v314.0.7/full/";
self.onmessage = async ({ data }) => {
  try {
    const { loadPyodide } = await import(base + "pyodide.mjs");
    const python = await loadPyodide({ indexURL: base });
    python.setStdin({
      stdin: () => {
        throw Error(
          "Interactive input is not supported; assign a value in the code instead.",
        );
      },
    });
    self.postMessage({ phase: "running" });
    python.runPython(data.tracer);
    const trace = python.globals.get("article_trace");
    try {
      const result = JSON.parse(trace(data.code));
      self.postMessage({ phase: "done", ...result });
    } finally {
      trace.destroy();
    }
  } catch (error) {
    self.postMessage({ phase: "error", error: String(error).slice(0, 4000) });
  }
};
