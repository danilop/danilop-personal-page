import { pythonSandbox } from "./python-sandbox";

export function mountPythonRunner(root: HTMLElement) {
  const editor = root.querySelector<HTMLTextAreaElement>("[data-python-code]")!;
  const initial = editor.value;
  const run = root.querySelector<HTMLButtonElement>("[data-python-run]")!;
  const stop = root.querySelector<HTMLButtonElement>("[data-python-stop]")!;
  const status = root.querySelector<HTMLElement>("[data-python-status]")!;
  const output = root.querySelector<HTMLElement>("[data-python-output]")!;
  let frame: HTMLIFrameElement | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const finish = (message: string) => {
    clearTimeout(timer);
    frame?.remove();
    frame = undefined;
    run.disabled = false;
    stop.disabled = true;
    editor.readOnly = false;
    status.textContent = message;
  };
  const deadline = (ms: number, message: string) => {
    clearTimeout(timer);
    timer = setTimeout(() => finish(message), ms);
  };
  const receive = (event: MessageEvent) => {
    if (!frame || event.source !== frame.contentWindow) return;
    const data = event.data;
    if (data?.phase === "ready")
      frame.contentWindow!.postMessage({ code: editor.value }, "*");
    if (data?.phase === "running") {
      status.textContent = "Running Python…";
      deadline(
        10000,
        "Stopped after 10 seconds. Check for an endless loop, then try again.",
      );
    }
    if (data?.phase === "done" || data?.phase === "error") {
      output.textContent =
        typeof data.output === "string" ? data.output.slice(0, 65536) : "";
      finish(
        data.phase === "done"
          ? "Finished."
          : `Could not finish: ${String(data.error).slice(0, 4000)}`,
      );
    }
  };
  run.addEventListener("click", () => {
    finish("Ready to run.");
    if (!editor.value.trim() || editor.value.length > 16000) {
      status.textContent = "Enter between 1 and 16,000 characters of Python.";
      return;
    }
    output.textContent = "";
    run.disabled = true;
    stop.disabled = false;
    editor.readOnly = true;
    status.textContent =
      "Loading Python… You can stop the download at any time.";
    frame = document.createElement("iframe");
    frame.title = "Isolated Python runner";
    frame.hidden = true;
    frame.setAttribute("sandbox", "allow-scripts");
    frame.referrerPolicy = "no-referrer";
    frame.srcdoc = pythonSandbox();
    root.append(frame);
    deadline(
      90000,
      "Python took too long to load. Check your connection and try again.",
    );
  });
  stop.addEventListener("click", () =>
    finish("Stopped. Your code is unchanged."),
  );
  root
    .querySelector<HTMLButtonElement>("[data-python-reset]")!
    .addEventListener("click", () => {
      finish("Original code restored.");
      editor.value = initial;
      output.textContent = "";
    });
  window.addEventListener("message", receive);
  window.addEventListener("pagehide", () => finish("Stopped."));
  root.querySelector<HTMLElement>("[data-code-static]")!.hidden = true;
  root.querySelector<HTMLElement>("[data-python-controls]")!.hidden = false;
}
