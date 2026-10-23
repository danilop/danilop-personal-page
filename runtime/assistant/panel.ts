import models from "../../publishing/models.json";
import type { ModelDescriptor, ModelSession, AgentChat } from "../contracts";
import { modelRuntimes } from "../model-registry";
import { agentTools, outline, sectionAnchor } from "../agent-tools/tools";
import {
  answerTool,
  askQuestion,
  systemPrompt,
  type AssistantAnswer,
  type AssistantStep,
  type PageSection,
} from "./loop";

/** Runtime ladder: the browser's model first, then the downloadable one. */
const LADDER = ["browser-language-model", "gemma-4-E2B-it-web"];
const TOOLS = [
  "find_in_page",
  "get_section_text",
  "list_code_examples",
  "run_code_example",
];

const STYLE = `
.assistant-panel{position:fixed;z-index:110;right:0;top:0;bottom:0;width:380px;display:flex;flex-direction:column;background:var(--paper,#f6f3eb);color:var(--ink,#13191c);border-left:1px solid var(--rule,#708091);box-shadow:-6px 0 22px rgb(19 25 28/12%);font:15px/1.5 var(--sans,Inter),sans-serif}
.assistant-panel[hidden]{display:none}
.assistant-panel header{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:14px 18px;border-bottom:1px solid var(--hairline,#c9c9c3)}
.assistant-panel h2{margin:0;font:600 17px/1.3 var(--sans,Inter),sans-serif}
.assistant-panel .assistant-close{border:0;background:none;font-size:22px;line-height:1;padding:4px 8px;cursor:pointer;color:inherit}
.assistant-body{flex:1;overflow:auto;padding:14px 18px}
.assistant-note{color:var(--muted,#586371);font-size:13px;margin:0 0 12px}
.assistant-actions{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0}
.assistant-suggestions{display:flex;flex-direction:column;align-items:flex-start;gap:6px;margin:8px 0 14px}
.assistant-suggestions button{border:1px solid var(--hairline,#c9c9c3);border-radius:14px;background:none;padding:4px 10px;font:inherit;font-size:13px;text-align:left;cursor:pointer;color:inherit}
.assistant-turn{border-top:1px solid var(--hairline,#c9c9c3);padding:12px 0}
.assistant-question{font-weight:600;margin:0 0 6px}
.assistant-steps{list-style:none;margin:0 0 6px;padding:0;color:var(--muted,#586371);font-size:13px}
.assistant-answer{margin:0 0 6px;white-space:pre-wrap}
.assistant-sources{font-size:13px;margin:0}
.assistant-panel a{color:var(--blue,#164b88)}
.assistant-form{border-top:1px solid var(--hairline,#c9c9c3);padding:12px 18px;display:flex;flex-direction:column;gap:8px}
.assistant-form textarea{width:100%;box-sizing:border-box;min-height:58px;padding:8px;border:1px solid var(--rule,#708091);border-radius:4px;font:inherit;background:#fff;color:var(--ink,#13191c)}
.assistant-form .assistant-actions{margin:0}
.assistant-form[hidden]{display:none}
.assistant-cited{outline:2px solid var(--blue,#164b88);outline-offset:6px}
.assistant-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
@media (min-width:1100px){body.assistant-is-open{padding-right:380px}body.assistant-is-open .analytics-choice{right:calc(380px + 1rem)}}
@media (max-width:1099px){.assistant-panel{top:auto;left:0;width:auto;max-height:72vh;border-left:0;border-top:1px solid var(--rule,#708091);box-shadow:0 -6px 22px rgb(19 25 28/12%)}}
`;

type Probed = {
  model: ModelDescriptor;
  download: boolean;
};

function el<T extends HTMLElement = HTMLElement>(
  tag: string,
  props: Record<string, unknown> = {},
  ...children: (Node | string)[]
): T {
  const node = Object.assign(document.createElement(tag), props) as T;
  node.append(...children);
  return node;
}

const gb = (bytes: number) => (bytes / 1e9).toFixed(1);

function introduction({ model, download }: Probed) {
  if (model.format === "builtin")
    return download
      ? "Your browser can download its built-in model (about 3–4 GB, shared with other sites). This happens once."
      : "Runs on this device using your browser's built-in model. Your questions stay in this browser.";
  const size = "downloadBytes" in model ? gb(model.downloadBytes) : "?";
  return download
    ? `Downloads ${model.label ?? model.id} (about ${size} GB) from Hugging Face into this browser's storage for this site, once. It then runs on your device; your questions stay in this browser.`
    : `Uses ${model.label ?? model.id}, already downloaded in this browser. Your questions stay in this browser.`;
}

function contextMessage(error: unknown) {
  const text = String(error);
  return /context|token|too long|quota/i.test(text)
    ? "This question needs more of the page than the model can read at once; try a narrower question."
    : `The model stopped with an error: ${text.slice(0, 200)}`;
}

export function mountAssistant(entry: HTMLElement) {
  const open = entry.querySelector<HTMLButtonElement>("[data-assistant-open]")!;
  const article = document.querySelector("main article.reading")!;
  const style = el("style", { textContent: STYLE });
  document.head.append(style);
  const title = el(
    "h2",
    { id: "assistant-title", tabIndex: -1 },
    "Ask about this page",
  );
  const close = el(
    "button",
    {
      type: "button",
      className: "assistant-close",
      ariaLabel: "Close the assistant",
    },
    "×",
  );
  const body = el("div", { className: "assistant-body" });
  const status = el("p", { className: "assistant-sr" });
  status.setAttribute("role", "status");
  const textarea = el<HTMLTextAreaElement>("textarea", {
    rows: 2,
    placeholder: "Ask a question about this page",
  });
  textarea.setAttribute("aria-label", "Your question");
  const ask = el<HTMLButtonElement>("button", { type: "submit" }, "Ask");
  const stop = el("button", { type: "button", hidden: true }, "Stop");
  const reset = el("button", { type: "button" }, "New conversation");
  const form = el<HTMLFormElement>(
    "form",
    { className: "assistant-form", hidden: true },
    textarea,
    el("div", { className: "assistant-actions" }, ask, stop, reset),
  );
  const panel = el(
    "aside",
    { id: "assistant-panel", className: "assistant-panel", hidden: true },
    el("header", {}, title, close),
    body,
    form,
    status,
  );
  panel.setAttribute("aria-labelledby", "assistant-title");
  document.body.append(panel);

  let session: ModelSession | undefined;
  let chosen: Probed | undefined;
  let busy: AbortController | undefined;
  let chat: AgentChat | undefined;
  const transcript = el("div", { className: "assistant-transcript" });

  const sections = (): PageSection[] => outline(document);
  const pageTitle = () =>
    (
      article.querySelector("h1")?.firstChild?.textContent ?? document.title
    ).trim();

  function show(...nodes: (Node | string)[]) {
    body.replaceChildren(...nodes);
  }
  function note(text: string) {
    return el("p", { className: "assistant-note" }, text);
  }
  const honesty = () =>
    note(
      "A small model running on your device. It can be wrong; the text is the reference.",
    );

  function setOpen(value: boolean) {
    panel.hidden = !value;
    open.setAttribute("aria-expanded", String(value));
    document.body.classList.toggle("assistant-is-open", value);
    if (value) title.focus();
    else open.focus();
  }

  async function probe() {
    show(note("Checking what this browser can run…"));
    const reasons: string[] = [];
    for (const id of LADDER) {
      const model = models.models.find((m) => m.id === id) as ModelDescriptor;
      const result = await modelRuntimes[model.runtime].probe(model);
      if (result.supported) return { model, download: !!result.download };
      if (result.reason) reasons.push(result.reason);
    }
    show(
      note("This browser cannot run the reading assistant on this device."),
      note(reasons.join(" ")),
      note("Search and the page itself work as usual."),
    );
  }

  function offerStart(probed: Probed) {
    const start = el(
      "button",
      { type: "button" },
      probed.download
        ? probed.model.format === "builtin"
          ? "Download and start"
          : `Download (about ${"downloadBytes" in probed.model ? gb(probed.model.downloadBytes) : "?"} GB)`
        : "Start",
    );
    const later = el("button", { type: "button" }, "Not now");
    start.addEventListener("click", () => void load(probed));
    later.addEventListener("click", () => setOpen(false));
    const extra =
      navigator.language && !/^en\b/i.test(navigator.language)
        ? [note("The site is in English; questions work best in English.")]
        : [];
    show(
      note(introduction(probed)),
      ...extra,
      el("div", { className: "assistant-actions" }, start, later),
      honesty(),
    );
  }

  async function load(probed: Probed) {
    const runtime = modelRuntimes[probed.model.runtime];
    const progress = note("Preparing the model…");
    const cancel = el("button", { type: "button" }, "Cancel");
    const controller = new AbortController();
    cancel.addEventListener("click", () => controller.abort());
    show(progress, el("div", { className: "assistant-actions" }, cancel));
    try {
      session = await runtime.load(
        probed.model,
        (text) => (progress.textContent = text),
        controller.signal,
      );
      document.dispatchEvent(
        new CustomEvent("notes:assistant-started", {
          detail: { runtime: runtime.id },
        }),
      );
      ready();
    } catch (error) {
      session = undefined;
      offerStart(probed);
      body.prepend(
        note(
          controller.signal.aborted
            ? "Cancelled. Nothing more was downloaded."
            : `Could not start the model: ${String(error).slice(0, 200)}`,
        ),
      );
    }
  }

  function suggestions() {
    const first = sections().find((s) => s.id !== "introduction");
    const items = [
      "What is the main point of this page?",
      ...(first ? [`What does “${first.title}” explain?`] : []),
      ...(document.querySelector("[data-code-activity]")
        ? ["Run the first code example and explain its output."]
        : []),
    ];
    return el(
      "div",
      { className: "assistant-suggestions" },
      ...items.map((q) => {
        const b = el("button", { type: "button" }, q);
        b.addEventListener("click", () => {
          textarea.value = q;
          form.requestSubmit();
        });
        return b;
      }),
    );
  }

  function ready() {
    const clear =
      chosen?.model.format === "litertlm"
        ? [
            el(
              "button",
              { type: "button", className: "assistant-clear" },
              "Clear downloaded model",
            ),
          ]
        : [];
    clear[0]?.addEventListener("click", () => void clearModel());
    transcript.replaceChildren();
    show(honesty(), suggestions(), transcript, ...clear);
    form.hidden = false;
    textarea.focus();
  }

  async function clearModel() {
    await dispose();
    await modelRuntimes[chosen!.model.runtime].clear(chosen!.model);
    form.hidden = true;
    chosen = { ...chosen!, download: true };
    offerStart(chosen);
    body.prepend(note("The downloaded model was removed from this browser."));
  }

  async function dispose() {
    busy?.abort();
    await chat?.dispose().catch(() => undefined);
    chat = undefined;
    await session?.dispose().catch(() => undefined);
    session = undefined;
  }

  function stepLine(step: AssistantStep) {
    const input = step.input as Record<string, string>;
    if (step.tool === "get_section_text") {
      const section = sections().find((s) => s.id === input.section);
      return el(
        "li",
        {},
        "Read section ",
        el(
          "a",
          { href: `#${input.section}` },
          `“${section?.title ?? input.section}”`,
        ),
      );
    }
    if (step.tool === "find_in_page")
      return el("li", {}, `Looked for “${input.query}” in this page`);
    if (step.tool === "run_code_example")
      return el("li", {}, `Ran the code example “${input.id}”`);
    return el("li", {}, "Listed the code examples");
  }

  function renderAnswer(turn: HTMLElement, answer: AssistantAnswer) {
    turn.dataset.found = String(answer.found);
    const text =
      answer.text ||
      (answer.found
        ? "The model gave no answer. Try rephrasing."
        : "The page does not seem to say.");
    turn.append(
      el(
        "p",
        { className: "assistant-answer" },
        answer.found
          ? text
          : text.replace(/^false$/i, "The page does not seem to say."),
      ),
    );
    const titles = new Map(sections().map((s) => [s.id, s.title]));
    if (answer.citations.length)
      turn.append(
        el(
          "p",
          { className: "assistant-sources" },
          "From: ",
          ...answer.citations.flatMap((id, i) => {
            const link = el("a", { href: `#${id}` }, titles.get(id) ?? id);
            link.addEventListener("click", (event) => {
              const target = sectionAnchor(document, id);
              if (!target) return;
              event.preventDefault();
              target.scrollIntoView({ block: "start" });
              target.classList.add("assistant-cited");
              setTimeout(
                () => target.classList.remove("assistant-cited"),
                3000,
              );
            });
            return i ? [", ", link] : [link];
          }),
        ),
      );
    else if (answer.found)
      turn.append(
        note("No section was cited; check the answer against the page."),
      );
    status.textContent = `Answer: ${turn.querySelector(".assistant-answer")!.textContent}`;
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const question = textarea.value.trim();
    const current = session;
    if (!question || busy || !current?.startAgentChat) return;
    textarea.value = "";
    const steps = el("ol", { className: "assistant-steps" });
    const turn = el(
      "section",
      { className: "assistant-turn" },
      el("p", { className: "assistant-question" }, question),
      steps,
    );
    transcript.append(turn);
    const thinking = note("Thinking…");
    turn.append(thinking);
    busy = new AbortController();
    const signal = busy.signal;
    ask.disabled = true;
    stop.hidden = false;
    void (async () => {
      const list = sections();
      const tools = agentTools.filter(
        (t) => TOOLS.includes(t.name) && t.available(document),
      );
      try {
        await chat?.dispose();
        chat = await current.startAgentChat!(systemPrompt(pageTitle(), list), [
          ...tools.map((t) => ({
            name: t.name,
            description: t.description,
            inputSchema: t.inputSchema,
          })),
          answerTool(list),
        ]);
        const answer = await askQuestion(
          chat,
          question,
          tools,
          signal,
          (step) => steps.append(stepLine(step)),
        );
        thinking.remove();
        renderAnswer(turn, answer);
      } catch (error) {
        if (!signal.aborted) console.error("Assistant error", error);
        thinking.textContent = signal.aborted
          ? "Stopped."
          : contextMessage(error);
      } finally {
        busy = undefined;
        ask.disabled = false;
        stop.hidden = true;
        turn.scrollIntoView?.({ block: "nearest" });
      }
    })();
  });
  stop.addEventListener("click", () => busy?.abort());
  reset.addEventListener("click", () => {
    busy?.abort();
    transcript.replaceChildren();
    textarea.focus();
  });
  close.addEventListener("click", () => setOpen(false));
  panel.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setOpen(false);
  });
  window.addEventListener("pagehide", () => void dispose());
  open.addEventListener("click", () => {
    if (!panel.hidden) return setOpen(false);
    setOpen(true);
    if (session || chosen) return;
    void probe().then((probed) => {
      if (!probed) return;
      chosen = probed;
      offerStart(probed);
    });
  });
}
