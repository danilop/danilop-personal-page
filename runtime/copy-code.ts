/** Copy the edited source without disturbing execution, selection or focus. */
export function bindCopyCode(root: HTMLElement, editor: HTMLTextAreaElement) {
  const button = root.querySelector<HTMLButtonElement>("[data-python-copy]")!;
  const status = root.querySelector<HTMLElement>("[data-copy-status]")!;
  async function copy() {
    button.disabled = true;
    try {
      await navigator.clipboard.writeText(editor.value);
      status.textContent = "Code copied.";
    } catch {
      status.textContent =
        "Copy unavailable. Select the code and use your device’s Copy command.";
    } finally {
      button.disabled = false;
    }
  }
  button.addEventListener("click", () => {
    void copy();
  });
  editor.addEventListener("input", () => {
    status.textContent = "";
  });
}
