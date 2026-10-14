type PythonStep = { line: number | null; outputLength: number };
export type PythonRecording = {
  steps: PythonStep[];
  output: string;
  error: string;
};

export function pythonTracePlayer(root: HTMLElement, status: HTMLElement) {
  const editor = root.querySelector<HTMLTextAreaElement>("[data-python-code]")!;
  const output = root.querySelector<HTMLElement>("[data-python-output]")!;
  let recording: PythonRecording | undefined;
  let position = 0;
  editor.addEventListener("scroll", () => paintHighlight(editor));
  function render() {
    const current = recording!.steps[position];
    highlightLine(editor, current.line);
    const complete = position === recording!.steps.length - 1;
    output.textContent = recording!.output.slice(0, current.outputLength);
    if (complete && recording!.error)
      output.textContent += `${output.textContent ? "\n" : ""}${recording!.error}`;
    status.textContent = complete
      ? recording!.error
        ? "Stopped with an error."
        : "Finished."
      : `Next line ${current.line}.`;
  }
  return {
    loaded: () => !!recording,
    load(value: PythonRecording) {
      recording = value;
      position = 0;
      render();
    },
    run() {
      position = recording!.steps.length - 1;
      render();
    },
    step() {
      position = position === recording!.steps.length - 1 ? 0 : position + 1;
      render();
    },
    clear() {
      recording = undefined;
      highlightLine(editor, null);
      output.textContent = "";
    },
  };
}

function paintHighlight(editor: HTMLTextAreaElement) {
  if (!editor.dataset.currentLine) return;
  const style = getComputedStyle(editor);
  const top =
    parseFloat(style.paddingTop) +
    (Number(editor.dataset.currentLine) - 1) * parseFloat(style.lineHeight) -
    editor.scrollTop;
  editor.style.setProperty("--python-line-top", `${top}px`);
}

function highlightLine(editor: HTMLTextAreaElement, line: number | null) {
  if (line === null) {
    delete editor.dataset.currentLine;
    editor.style.removeProperty("--python-line-top");
    return;
  }
  editor.dataset.currentLine = String(line);
  const style = getComputedStyle(editor);
  const height = parseFloat(style.lineHeight);
  const top = parseFloat(style.paddingTop) + (line - 1) * height;
  if (
    top < editor.scrollTop ||
    top + height > editor.scrollTop + editor.clientHeight
  )
    editor.scrollTop = Math.max(0, top - editor.clientHeight / 2);
  paintHighlight(editor);
}
