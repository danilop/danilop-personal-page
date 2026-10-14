type StepDemo = {
  label(step: number, count: number): string;
  draw(host: HTMLElement, step: number): void;
};
const demos: Record<string, StepDemo> = {
  tally: {
    label: (step, count) =>
      `Step ${step} of ${count} · ${step} ${step === 1 ? "mark" : "marks"} stored · len(notches) = ${step}`,
    draw(host, step) {
      host.replaceChildren();
      for (let i = 0; i < step; i++) {
        const mark = document.createElement("span");
        mark.textContent = "|";
        host.append(mark);
      }
    },
  },
};

export function mountStepDemo(root: HTMLElement) {
  const demo = demos[root.dataset.stepDemo!];
  if (!demo) return;
  const initial = Number(root.dataset.count);
  const count = root.querySelector<HTMLInputElement>("[data-demo-count]")!;
  const status = root.querySelector<HTMLElement>("[data-demo-status]")!;
  const marks = root.querySelector<HTMLElement>("[data-demo-marks]")!;
  const play = root.querySelector<HTMLButtonElement>("[data-demo-play]")!;
  const next = root.querySelector<HTMLButtonElement>("[data-demo-step]")!;
  const back = root.querySelector<HTMLButtonElement>("[data-demo-back]")!;
  let step = 0;
  let timer: ReturnType<typeof setInterval> | undefined;
  const valid = () =>
    count.value !== "" &&
    Number.isInteger(Number(count.value)) &&
    Number(count.value) >= 0 &&
    Number(count.value) <= 50;
  function pause() {
    clearInterval(timer);
    timer = undefined;
    play.textContent = "▶ Play";
  }
  function render() {
    const ok = valid();
    next.disabled = !ok || step >= Number(count.value);
    back.disabled = !ok || step === 0;
    play.disabled = !ok || Number(count.value) === 0;
    count.setAttribute("aria-invalid", String(!ok));
    status.textContent = ok
      ? demo.label(step, Number(count.value))
      : "Choose a whole number from 0 to 50.";
    demo.draw(marks, step);
  }
  function advance() {
    if (valid()) step = Math.min(step + 1, Number(count.value));
    if (step >= Number(count.value)) pause();
    render();
  }
  count.addEventListener("input", () => {
    pause();
    step = 0;
    render();
  });
  next.addEventListener("click", () => {
    pause();
    advance();
  });
  back.addEventListener("click", () => {
    pause();
    step = Math.max(0, step - 1);
    render();
  });
  play.addEventListener("click", () => {
    if (timer) {
      pause();
      return;
    }
    if (step >= Number(count.value)) step = 0;
    play.textContent = "⏸ Pause";
    timer = setInterval(advance, 650);
    render();
  });
  root.querySelector("[data-demo-reset]")!.addEventListener("click", () => {
    pause();
    step = 0;
    count.value = String(initial);
    render();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) pause();
  });
  window.addEventListener("pagehide", pause);
  render();
  root.hidden = false;
}
