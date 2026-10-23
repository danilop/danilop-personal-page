let notice: HTMLElement | undefined;
let hideTimer: ReturnType<typeof setTimeout> | undefined;
let highlighted: Element | undefined;

function hide() {
  clearTimeout(hideTimer);
  if (notice) notice.hidden = true;
  highlighted?.classList.remove("agent-highlight");
  highlighted = undefined;
}

// Injected with the first notice so pages without agents carry no styles.
const STYLE = `.agent-notice {
  position: fixed;
  z-index: 90;
  inset: auto 1rem 1rem auto;
  display: flex;
  align-items: center;
  gap: 12px;
  max-width: min(32rem, calc(100vw - 2rem));
  padding: 10px 12px 10px 16px;
  border: 1px solid var(--rule, #708091);
  border-radius: 6px;
  background: var(--paper, #f6f3eb);
  color: var(--ink, #13191c);
  box-shadow: 0 4px 18px rgb(19 25 28 / 18%);
  font: 14px/1.4 var(--sans, Inter), sans-serif;
}

.agent-notice[hidden] {
  display: none;
}

.agent-notice p {
  margin: 0;
  flex: 1;
}

.agent-notice button {
  flex: none;
}

.agent-notice [data-agent-close] {
  border: 0;
  background: none;
  font-size: 20px;
  line-height: 1;
  padding: 2px 6px;
  cursor: pointer;
}

.agent-highlight {
  outline: 2px dashed var(--blue, #164b88);
  outline-offset: 6px;
}`;

function ensureNotice() {
  if (notice?.isConnected && notice.ownerDocument === document) return notice;
  const style = document.createElement("style");
  style.textContent = STYLE;
  document.head.append(style);
  notice = document.createElement("div");
  notice.className = "agent-notice";
  notice.hidden = true;
  notice.innerHTML =
    '<p role="status" aria-live="polite"></p><button type="button" data-agent-undo hidden>Undo</button><button type="button" data-agent-close aria-label="Dismiss notice">×</button>';
  notice
    .querySelector("[data-agent-close]")!
    .addEventListener("click", () => hide());
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !notice!.hidden) hide();
  });
  document.body.append(notice);
  return notice;
}

const reducedMotion = () =>
  typeof matchMedia === "function" &&
  matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Show and announce what an agent did, outline the affected element and offer
 * Undo when the action can be reversed.
 */
export function announceAgentAction(
  message: string,
  options: { target?: Element | null; undo?: () => void } = {},
) {
  const box = ensureNotice();
  hide();
  box.querySelector("p")!.textContent = message;
  const undo = box.querySelector<HTMLButtonElement>("[data-agent-undo]")!;
  undo.hidden = !options.undo;
  undo.onclick = () => {
    options.undo?.();
    hide();
  };
  box.hidden = false;
  if (options.target) {
    highlighted = options.target;
    highlighted.classList.add("agent-highlight");
    highlighted.scrollIntoView?.({
      block: "start",
      behavior: reducedMotion() ? "auto" : "smooth",
    });
  }
  hideTimer = setTimeout(hide, options.undo ? 10000 : 6000);
}
