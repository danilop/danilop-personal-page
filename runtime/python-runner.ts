import { pythonSandbox } from "./python-sandbox";
import { bindCopyCode } from "./copy-code";
import { pythonTracePlayer, type PythonRecording } from "./python-trace-player";

type PythonResult = { status: string; output: string; line?: number };
export type PythonController = {
  /** Run to the end; replaces the code first when given. */
  run(code?: string): Promise<PythonResult>;
  /** Show the next recorded line, running first if needed. */
  step(): Promise<PythonResult>;
  restore(): PythonResult;
};
const controllers = new WeakMap<HTMLElement, PythonController>();

/** Buttons and agent tools share one controller per activity. */
export function mountPythonRunner(root: HTMLElement): PythonController {
  const existing = controllers.get(root);
  if (existing) return existing;
  const editor = root.querySelector<HTMLTextAreaElement>("[data-python-code]")!;
  const initial = editor.value;
  bindCopyCode(root, editor);
  const run = root.querySelector<HTMLButtonElement>("[data-python-run]")!;
  const step = root.querySelector<HTMLButtonElement>("[data-python-step]")!;
  const status = root.querySelector<HTMLElement>("[data-python-status]")!;
  const player = pythonTracePlayer(root, status);
  let frame: HTMLIFrameElement | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let runToEnd = false;
  let source = "";
  let settled: (() => void)[] = [];
  const output = root.querySelector<HTMLElement>("[data-python-output]")!;
  const result = (): PythonResult => ({
    status: status.textContent ?? "",
    output: output.textContent ?? "",
    ...(editor.dataset.currentLine
      ? { line: Number(editor.dataset.currentLine) }
      : {}),
  });
  const finish = (message: string) => {
    clearTimeout(timer);
    frame?.remove();
    frame = undefined;
    run.disabled = false;
    step.disabled = false;
    status.textContent = message;
  };
  // Resolved after the recording is shown, or when loading or running stops.
  const settle = () => {
    const waiting = settled;
    settled = [];
    for (const resolve of waiting) resolve();
  };
  const deadline = (ms: number, message: string) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      finish(message);
      settle();
    }, ms);
  };
  const receive = (event: MessageEvent) => {
    if (!frame || event.source !== frame.contentWindow) return;
    const data = event.data;
    if (data?.phase === "ready")
      frame.contentWindow!.postMessage({ code: source }, "*");
    if (data?.phase === "running") {
      status.textContent = "Running Python…";
      deadline(
        10000,
        "Stopped after 10 seconds. Check for an endless loop, then try again.",
      );
    }
    if (data?.phase === "done") {
      finish("Execution recorded.");
      if (!validRecording(data, source.split("\n").length)) {
        status.textContent =
          "Python returned an invalid execution recording. Try again.";
        settle();
        return;
      }
      player.load(data);
      if (runToEnd) player.run();
      settle();
    }
    if (data?.phase === "error") {
      finish(`Could not finish: ${String(data.error).slice(0, 4000)}`);
      settle();
    }
  };
  function start(play: boolean) {
    if (player.loaded()) {
      if (play) player.run();
      else player.step();
      return;
    }
    finish("Ready to run.");
    if (!editor.value.trim() || editor.value.length > 16000) {
      status.textContent = "Enter between 1 and 16,000 characters of Python.";
      return;
    }
    source = editor.value;
    runToEnd = play;
    run.disabled = step.disabled = true;
    status.textContent = "Loading Python… Restore original cancels.";
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
  }
  function edit(message: string) {
    finish(message);
    settle();
    player.clear();
  }
  function restore() {
    edit("Original code restored.");
    editor.value = initial;
    editor.scrollTop = editor.scrollLeft = 0;
    root.querySelector<HTMLElement>("[data-copy-status]")!.textContent = "";
  }
  async function perform(play: boolean) {
    const done = new Promise<void>((resolve) => settled.push(resolve));
    start(play);
    if (frame) await done;
    else settle();
    return result();
  }
  run.addEventListener("click", () => start(true));
  step.addEventListener("click", () => start(false));
  root.querySelector("[data-python-reset]")!.addEventListener("click", restore);
  editor.addEventListener("input", () => edit("Code changed. Ready to run."));
  window.addEventListener("message", receive);
  window.addEventListener("pagehide", () => {
    finish("Stopped.");
    settle();
    player.clear();
  });
  root.querySelector<HTMLElement>("[data-code-static]")!.hidden = true;
  root.querySelector<HTMLElement>("[data-python-controls]")!.hidden = false;
  const controller: PythonController = {
    run(code) {
      if (code !== undefined && code !== editor.value) {
        editor.value = code;
        edit("Code changed. Ready to run.");
      }
      return perform(true);
    },
    step: () => perform(false),
    restore() {
      restore();
      return result();
    },
  };
  controllers.set(root, controller);
  return controller;
}

function validRecording(data: PythonRecording, lines: number) {
  return (
    typeof data.output === "string" &&
    data.output.length <= 65536 &&
    typeof data.error === "string" &&
    data.error.length <= 4000 &&
    Array.isArray(data.steps) &&
    data.steps.length > 0 &&
    data.steps.length <= 501 &&
    data.steps.every(
      (s) =>
        s &&
        (s.line === null ||
          (Number.isInteger(s.line) && s.line > 0 && s.line <= lines)) &&
        Number.isInteger(s.outputLength) &&
        s.outputLength >= 0 &&
        s.outputLength <= data.output.length,
    )
  );
}
