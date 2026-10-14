// Loaded as text into a module Worker inside the opaque-origin runner frame.
const base = "https://cdn.jsdelivr.net/pyodide/v314.0.7/full/";
self.onmessage = async ({ data }) => {
  let output = "";
  let inputRequested = false;
  let outputLimited = false;
  const append = (line) => {
    output += line + "\n";
    if (output.length > 65536) {
      outputLimited = true;
      output = output.slice(0, 65536);
      throw Error("Output limit reached (64 KiB).");
    }
  };
  try {
    const { loadPyodide } = await import(base + "pyodide.mjs");
    const python = await loadPyodide({
      indexURL: base,
      stdout: append,
      stderr: append,
    });
    python.setStdin({
      stdin: () => {
        inputRequested = true;
        throw Error(
          "Interactive input is not supported; assign a value in the code instead.",
        );
      },
    });
    self.postMessage({ phase: "running" });
    await python.runPythonAsync(data.code);
    self.postMessage({ phase: "done", output });
  } catch (error) {
    const message = inputRequested
      ? "Interactive input is not supported; assign a value in the code instead."
      : outputLimited
        ? "Output limit reached (64 KiB)."
        : String(error);
    self.postMessage({
      phase: "error",
      output,
      error: message.slice(0, 4000),
    });
  }
};
