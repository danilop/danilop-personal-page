# Agent tools and in-browser models: technical and UX plan

Status: proposed on 23 October 2026; the owner accepted the plan's decisions the
same day ([§8](#8-decisions)). Nothing is implemented yet. It builds on the
[WebMCP research](webmcp-research.md) and extends the existing browser-model
rules in [architecture §6](architecture.md#6-browser-experiments). Site-wide
search and a reader assistant, previously deferred in
[product design](product-design.md), are now accepted, planned scope.

## 1. What is worth doing

| Capability                                         | Who benefits                                                  | Reach (October 2026)                                          | Verdict                                                                               |
| -------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Static full-text search                            | Every reader                                                  | All browsers, no model                                        | **Do first.** Also the retrieval layer for agents and the assistant                   |
| Shared agent tool registry                         | Agents, the site's own assistant, tests                       | Code is browser-independent                                   | **Do.** Small, and every later option reuses it                                       |
| WebMCP adapter (read/navigate tools)               | Visitors using ChatGPT desktop, Gemini in Chrome (2027), etc. | Chromium behind flag or origin trial                          | **Do as a labelled experiment**, feature-detected, with Chrome and Edge trial tokens  |
| Agent-operable Python activities                   | Readers learning with an agent beside them                    | Same as WebMCP                                                | **Do.** The most distinctive tool set for these books                                 |
| Browser-provided model adapter (Prompt API)        | Model experiments without a separate download                 | Chrome desktop 148+ with capable hardware; Edge Canary/Dev    | **Do**, small change to the existing runtime registry                                 |
| Reader assistant (“Ask about this page”)           | Readers on capable devices                                    | Chrome desktop, Edge preview, or WebGPU with a ~1 GB download | **Do**, on all reading pages, labelled as a small on-device model that can be wrong   |
| Summarizer / Translator / Writer APIs in reader UI | —                                                             | Chrome and Edge                                               | **Skip.** Browsers already offer page translation and summaries; Writer suits authors |
| Model features in the local editor                 | Author                                                        | Local                                                         | **Skip.** Coding agents and the existing review tools cover this                      |
| `llms.txt`, NLWeb, `.well-known` tool manifests    | —                                                             | —                                                             | **Skip** (see research)                                                               |

## 2. Principles

These extend the existing rules for experiments and models; none replaces them.

1. **Static first.** Pages, books and exports stay complete without JavaScript,
   models or agents. Nothing here changes book output.
2. **No download during reading.** Model files, including a browser's built-in
   model, are downloaded only after an explicit reader action that states the size.
3. **Local only, no cloud fallback.** Questions, page text and tool results never
   leave the device because of these features.
4. **One tool set, many callers.** WebMCP, the site's assistant and the tests call
   the same tool definitions, and each tool calls the handler a visible control
   already uses. No tool can do what the interface cannot, which answers WebKit's
   concern that a separate tool layer can drift from the page.
5. **Visible actions.** Whenever an agent acts, the page shows and announces what
   happened.
6. **Lazy and detectable.** Nothing loads unless the browser supports it: agent
   code only when `modelContext` exists, assistant code only on activation.
7. **Privacy-consistent analytics.** Only tool names and outcomes are counted,
   under the existing consent rules; never queries, prompts, code or answers.

## 3. Browser capability matrix

| Browser                  | WebMCP                           | Built-in language model                                                             | Task APIs                                       | WebGPU (WebLLM / Transformers.js)      | CPU fallback (WASM) |
| ------------------------ | -------------------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------- | -------------------------------------- | ------------------- |
| Chrome desktop           | Flag; origin trial from 149      | Prompt API (Gemini Nano) on by default since 148; tool calling not implemented yet  | Summarizer, Translator, Language Detector (138) | Yes                                    | Yes                 |
| Chrome Android           | No                               | No                                                                                  | No                                              | Android 12+ with supported GPUs        | Yes                 |
| Edge                     | Flag in Canary/Dev; origin trial | Prompt API preview in Canary/Dev (Phi-4-mini; Aion-1.0-Instruct on CPU, prerelease) | Translator, Language Detector (148)             | Yes                                    | Yes                 |
| Brave and other Chromium | Brave Nightly flag               | No (Gemini Nano ships only in official Chrome)                                      | No                                              | Yes                                    | Yes                 |
| Firefox                  | Hidden prototype, off            | No; Mozilla opposes the Prompt API. Extension-only `browser.trial.ml` API           | No                                              | Windows (141), Apple silicon Mac (145) | Yes                 |
| Safari                   | No; WebKit opposes WebMCP        | No web API                                                                          | No                                              | Safari 26 on macOS, iOS, iPadOS        | Yes                 |

Notes:

- **Prompt API requirements (Chrome):** Windows 10/11, macOS 13+, Linux or
  Chromebook Plus; 22 GB free disk; more than 4 GB VRAM, or 16 GB RAM and 4 cores
  for the CPU build; unmetered network for the first download. Input languages:
  English, Japanese, Spanish, German, French. Not exposed in Workers. Developers
  must acknowledge Google's Generative AI Prohibited Uses Policy. The browser does
  not report which model version answered.
  ([Chrome docs](https://developer.chrome.com/docs/ai/prompt-api),
  [Edge docs](https://learn.microsoft.com/en-us/microsoft-edge/web-platform/prompt-api))
- **Built-in models are shared** across sites and downloaded once by the browser
  (about 2.7–4 GB), so a reader may already have one. WebLLM models are
  per-origin downloads into the Cache API.
- **WebNN** is still an origin trial; keep it as a future adapter.

## 4. Architecture

```mermaid
flowchart TD
    I[Build: reading index + Pagefind full-text index] --> T
    subgraph Page runtime
      T[Agent tool registry<br/>runtime/agent-tools] --> W[WebMCP adapter<br/>document/navigator.modelContext]
      T --> A[Reader assistant loop]
      T --> F[Feedback layer<br/>highlight + live announcement]
      A --> R[Model runtime registry]
      R --> P[Prompt API adapter<br/>browser-provided]
      R --> L[WebLLM adapter<br/>existing, WebGPU]
    end
    U[Visible controls: search, chapters, narration, Python Run/Step] --- T
```

### 4.1 Reading index and search (phase 1)

- **Reading index.** Generated at build from the content core next to `rss.xml`:
  `/reading-index.json` with pieces, collections, chapter order, tags, canonical
  URLs, summaries and section anchors. Drafts are excluded. A few tens of KB.
- **Full-text search.** [Pagefind](https://pagefind.app/) 1.5.x indexes the built
  HTML after `astro build`, ships a WASM search client and chunked index loaded on
  demand, and works in every browser. Mark the reading text with
  `data-pagefind-body` so navigation, archive and original-site pages are
  excluded or weighted down. Pieces that appear both as an article and inside a
  book are indexed once, at the canonical URL already chosen for search engines
  ([content discovery](content-discovery.md)), with the other placements listed
  in the result. Alternative: a custom lexical index from the reading index,
  smaller but with more code to maintain.
- **Search UI.** A search link in the masthead opens a `/search/` page (with
  JavaScript, a dialog on any page, opened with `/`). The form is a real `<form
action="/search/">` with a labelled input, so it works without JavaScript as a
  link to the page. Results show title, collection or book, matching excerpt and
  date, in the Ink & Paper list style.
- **Declarative WebMCP for free.** The search form carries
  `toolname="search_writing"`, `tooldescription="Search Danilo's articles and
books"` and `toolparamdescription` on the input. Browsers with WebMCP expose it
  with no extra script; others ignore the attributes. This needs an HTML-validate
  allowance for the three attributes.

### 4.2 Agent tool registry (phase 2)

A framework-independent module, `runtime/agent-tools/`, defining each tool once:

```ts
type AgentTool = {
  name: string; // ASCII, stable, e.g. "run_code_example"
  title: string;
  description: string; // written for models: what, when, limits
  inputSchema: JSONSchema; // hand-written, small, validated in tests
  annotations: { readOnlyHint?: boolean; untrustedContentHint?: boolean };
  scope: "site" | "article" | "book" | "code-activity";
  available(doc: Document): boolean; // e.g. only if the page has activities
  execute(input: unknown, ctx: ToolContext): Promise<ToolResult>;
};
```

`ToolContext` carries an `AbortSignal`, the caller (`"webmcp"` or
`"assistant"`) and the feedback layer. Results are small JSON with URLs and
section IDs, capped in size (e.g. 8 KB for text), so a model cannot be flooded.
Input is validated against the schema by a small validator; Zod stays at build
time to keep the page bundle small.

Proposed tools:

| Tool                                                   | Scope         | Calls                                     | Annotations                       |
| ------------------------------------------------------ | ------------- | ----------------------------------------- | --------------------------------- |
| `search_writing(query, limit)`                         | site          | Pagefind                                  | read-only                         |
| `list_writing(tag?, type?)`                            | site          | reading index                             | read-only                         |
| `get_book_contents(collection)`                        | site          | reading index                             | read-only                         |
| `get_page_outline()`                                   | article, book | headings and section IDs on the page      | read-only                         |
| `get_section_text(sectionId)`                          | article, book | rendered text of one section              | read-only                         |
| `open_page(url)`                                       | site          | same-origin navigation only               | not read-only (navigates)         |
| `go_to_section(sectionId)`                             | article, book | scroll and focus, as an in-page link does | not read-only (moves focus)       |
| `play_narration(fromSectionId?)` / `pause_narration()` | article, book | existing narration and audiobook players  | not read-only                     |
| `list_code_examples()`                                 | code-activity | activities on the page, with titles       | read-only                         |
| `run_code_example(id, code?)`                          | code-activity | the same path as **Run**, editor updated  | untrusted content if code changed |
| `step_code_example(id)` / `restore_code_example(id)`   | code-activity | **Step** and **Restore original**         | not read-only                     |

Deliberately excluded: loading or downloading models, saving results, sharing,
analytics consent, anything in the local editor. These involve downloads,
files or consent and stay human-only.

Python tools reuse the existing sandbox: code runs in the opaque-origin iframe
and Worker, with the 16,000-character limit, 10-second run limit and validated
recording. To support this, `mountPythonRunner` returns a small controller
(`run(code?)`, `step()`, `restore()`, a result promise) used by both the
buttons and the tools, instead of tools clicking buttons.

### 4.3 WebMCP adapter (phase 2)

- `enhance.ts` checks `document.modelContext ?? navigator.modelContext` and only
  then imports the adapter, like simulations and code activities today.
- The adapter registers tools whose `available()` is true, each with one
  `AbortController` signal so all can be removed (on `pagehide`, or when the
  reader turns agent tools off).
- It wraps `execute` to call the feedback layer and to convert errors into short,
  model-readable messages without stack traces.
- **Tool surface integrity.** First-party tools register first. The adapter
  listens for `toolchange` and logs, in development, any tool it did not
  register. PostHog, the only third-party script and loaded only after consent,
  is the main source of possible extra tools.
- **Origin trials (decided: Chrome and Edge).** Local testing uses the browser
  flag. Production registers for both the Chrome and the Edge WebMCP origin
  trials and emits one `<meta http-equiv="origin-trial">` tag per token from site
  configuration (`publishing/site.yaml`, schema-validated with browser, token and
  expiry date). Tokens are public but tied to the domain; Edge's trial currently
  lists 17 November 2026 and Chrome's runs to M156 (a reported extension is
  unconfirmed). The build warns 30 days before an expiry and omits expired
  tokens. Registration accounts and renewal dates belong in the private
  operations note.
- **No polyfill on production pages.** `@mcp-b/global` is useful for local
  experiments with MCP clients, but shipping it would add a non-standard API.

### 4.4 Model runtime extensions (phase 3)

The current contract (`runtime/contracts.ts`) assumes downloaded artifacts:
`ModelDescriptor` has URLs, byte counts and checksums. Built-in models have none
of these, so:

- Add a descriptor variant for browser-provided models, e.g.
  `{ id: "browser-language-model", runtime: "prompt-api", format: "builtin",
languages: ["en"] }`, with `downloadBytes` and `vramMB` absent. `models.json`
  validation accepts both variants.
- New adapter `runtime/adapters/prompt-api.ts` implementing `ModelRuntime`:
  - `probe` calls `LanguageModel.availability({ expectedInputs, expectedOutputs })`
    and maps `unavailable`, `downloadable`, `downloading` and `available` without
    starting a download.
  - `load` calls `LanguageModel.create({ monitor, signal, initialPrompts })` only
    after the reader confirms, and reports `downloadprogress`.
  - `run` uses `promptStreaming`; `reset` clones from the initial session;
    `dispose` destroys it; `clear` cannot delete a browser model, so the UI
    explains where the browser manages it.
- Extend `ModelSession` with an optional
  `generateJSON(messages, schema, signal)` used by the assistant. Prompt API
  implements it with `responseConstraint`; WebLLM with its JSON-schema response
  format.
- **Recorded results.** Built-in models are unversioned, so a recording stores
  `runtime: "prompt-api"`, the browser name and version, and
  `model: "browser-provided (unversioned)"`. Book examples keep using recorded
  outputs.
- Model experiments in articles gain an optional `runtimes` order, e.g.
  `[prompt-api, webllm]`. The experiment chooses the first available runtime and
  says which one is in use.
- Fix in passing: the WebLLM adapter reports version `0.2.85` while the lockfile
  has `0.2.86`; derive the label from the package instead.

### 4.5 Reader assistant (phase 4)

A bounded helper on every reading page (articles and book chapters, not the
archive or original-site snapshot): answer questions about the current page or
book, point to sections, and explain or run its code examples.

- **Runtime ladder (decided).** (1) The browser's built-in model through the
  Prompt API if available; (2) WebLLM with one pinned, tool-capable small
  instruct model (about 1 GB, chosen in a spike for JSON reliability) if WebGPU
  is available and the reader agrees to the download; (3) otherwise the
  assistant is not offered. No cloud model.
- **Agent loop.** Built-in models have no native tool calling yet, so the loop
  uses constrained JSON on every runtime:
  `{ "action": "call", "tool": "...", "input": {...} }` or
  `{ "action": "answer", "text": "...", "citations": ["section-id"] }`. At most
  four tool calls per question, then an answer is required. The loop uses the
  same registry as WebMCP. When the Prompt API ships `tools`, the adapter can use
  it without changing the tools.
- **Grounding.** Answers must cite section IDs returned by tools; citations that
  were not retrieved are dropped. The system prompt says the page text is the
  authority and the assistant must say when it does not know.
- **Context budget.** Use `session.contextWindow` and
  `measureContextUsage()` where available; retrieve sections, not whole chapters.
- **Languages.** Gemini Nano accepts five input languages; the site is in
  English, so the assistant is offered only when the reader's prompt language is
  supported, otherwise it says so.

## 5. UX and UI design

### 5.1 Where things appear

| Element                        | Placement                                                                            | Shown when                                              |
| ------------------------------ | ------------------------------------------------------------------------------------ | ------------------------------------------------------- |
| Search                         | Masthead link “Search” beside the existing navigation; `/` shortcut; `/search/` page | Always (the page works without JavaScript as a link)    |
| Agent activity notice          | Inline toast at the bottom of the viewport plus highlight of the affected element    | Only when an agent calls a tool                         |
| Agent tools disclosure         | Footer: “For AI agents” link to an `/agents/` page                                   | Always; the page explains, lists tools, offers a switch |
| “Ask about this page”          | Reading tools row beside listening controls on article and book pages                | Only after a capability probe finds a usable runtime    |
| Model experiment runtime label | Inside existing experiment blocks                                                    | When more than one runtime is possible                  |

### 5.2 Agent activity feedback

Agents act on behalf of the reader, so their effects must be visible and
reversible with the normal controls:

- The affected element (a section, a code activity, the narration player) gets a
  dashed outline in the accent colour, matching the `:tool-form-active` style used
  for declarative forms, and is scrolled into view unless reduced motion is set.
- A small notice reads, for example, “An AI agent ran ‘Counting tallies’” or
  “An AI agent opened Chapter 2”, with **Undo** where it applies (restore the
  code, return to the previous position). It is announced in an
  `aria-live="polite"` region and disappears after a few seconds or on Escape.
- The Python output and editor show the agent's code exactly as if the reader had
  typed it; **Restore original** works as usual.

### 5.3 “For AI agents” page

A short page in the site's voice explaining that the site offers tools to
browser agents, what each tool does, that tools only read the site or operate
visible controls, and that nothing is sent anywhere by the site. It includes a
**Turn off agent tools on this device** switch stored in `localStorage` (wrapped
in try/catch, default on). It also states which browsers support this today.

### 5.4 Reader assistant panel

- **Entry.** A quiet text button with an icon, “Ask about this page”, in the
  existing reading-tools style. No sparkle iconography or promotional copy.
- **Panel.** A non-modal side panel on wide screens (the article reflows to keep
  a comfortable measure) and a bottom sheet on narrow screens. It is a labelled
  `<aside>`, not a focus trap, so reading and listening continue. Escape closes
  it and returns focus to the button.
- **Before first use.** A plain explanation of what will happen, depending on the
  runtime:
  - Built-in model available: “Runs on this device using your browser's built-in
    model. Your questions stay in this browser.” → **Start**.
  - Built-in model downloadable: “Your browser can download its built-in model
    (about 3–4 GB, shared with other sites). This happens once.” →
    **Download and start** / **Not now**.
  - WebLLM: model name, size from the manifest and storage note →
    **Download (about 1 GB)**, with progress and **Cancel**, and **Clear
    downloaded model** later.
- **Conversation.** Three or four suggested questions generated from the page
  outline (“What problem does this chapter solve?”, “Run the first example and
  explain the output”). Answers stream; each tool step appears as a compact line
  (“Read section ‘Binary search’”, “Ran example 2”) linking to the section.
  Citations are section links that scroll to and highlight the passage.
- **Honesty.** A persistent one-line note: “A small model running on your device.
  It can be wrong; the text is the reference.” **Stop** during generation,
  **New conversation** to reset. Conversations are not stored after the page
  closes.
- **Failure states.** Unsupported language, context full (“This question needs
  more of the chapter than the model can read at once; try a narrower
  question.”), model removed by the browser, download failed. Each state says
  what still works (search, the text, the examples).
- **Accessibility.** All controls are real buttons with visible labels; streaming
  text is announced on completion rather than token by token; contrast and focus
  styles follow the theme; the panel works at 200% zoom and with keyboard only.

## 6. Privacy, safety and policy

- Page content and tool results are first-party, so `untrustedContentHint` is
  needed only where reader-edited code produces output.
- No consequential actions are exposed; the worst an agent can do is navigate,
  play audio or run sandboxed Python, all undoable.
- Analytics events, only after consent: `agent_tool_called` (tool name, caller,
  success) and `assistant_started` (runtime). Update
  [analytics and privacy](analytics-and-privacy.md) before adding them.
- Using the Prompt API requires acknowledging Google's Generative AI Prohibited
  Uses Policy; record that acknowledgement in the documentation for this feature.
- The “For AI agents” page and the assistant panel disclose model use and limits.

## 7. Delivery plan

| Phase                       | Scope                                                                                                | Size | Exit criteria                                                                                                              |
| --------------------------- | ---------------------------------------------------------------------------------------------------- | ---- | -------------------------------------------------------------------------------------------------------------------------- |
| 0. Spikes                   | WebMCP flag in Chrome and Edge; Prompt API probe and JSON constraints; one WebLLM tool-capable model | S    | Feature names, flags and Playwright launch options confirmed; model choice recorded                                        |
| 1. Index and search         | Reading index, Pagefind, search page and dialog, declarative tool attributes                         | M    | Search works in Chrome, Firefox, Safari; no-JS fallback; validate passes; index excludes drafts                            |
| 2. Tool registry and WebMCP | Registry, Python controller refactor, adapter, feedback layer, `/agents/` page                       | M    | Tool Inspector lists and runs every tool; unit tests with a fake `modelContext`; no change for browsers without WebMCP     |
| 3. Model runtimes           | Descriptor variant, Prompt API adapter, runtime order for experiments, recording changes             | S    | Existing WebLLM experiment unchanged; Prompt API path verified on a capable Chrome; unsupported paths show static results  |
| 4. Assistant                | Loop, panel, grounding, evaluation set covering every published piece                                | L    | Evaluation questions for each published piece answered with valid citations at an agreed rate; manual accessibility review |
| 5. Production enablement    | Chrome and Edge origin-trial tokens, release notes                                                   | S    | Deployed and verified; token expiry warning in build                                                                       |
| 6. Article                  | Write-up based on observed agent and model behaviour after release                                   | M    | Draft reviewed through the normal editorial workflow; linked from the “For AI agents” page once published                  |

### Testing

- **Unit (node:test):** schemas, validation, size caps, `available()` rules, the
  agent loop with a scripted fake model, citation filtering.
- **Browser (Playwright):** search and declarative form in all engines; WebMCP
  tools in Chromium launched with the WebMCP feature enabled (exact flag
  confirmed in phase 0); a mocked `LanguageModel` for the assistant UI states.
  Real Prompt API and WebLLM runs cannot happen in CI and are recorded as manual
  verification in [verification](verification.md).
- **Bundle budget:** pages without WebMCP or activation load no extra code beyond
  the feature checks.

### Documentation to update during implementation

[Architecture §6](architecture.md#6-browser-experiments) (runtime variants, tool
registry), [product design](product-design.md) (search and assistant move
from planned to implemented), [code activities](code-activities.md) (agent operation),
[analytics and privacy](analytics-and-privacy.md), [authoring
format](authoring-format.md) (experiment runtime order),
[implementation status](implementation-plan.md) and
[verification](verification.md).

## 8. Decisions

Accepted by the owner on 23 October 2026:

1. **Search:** static full-text search with Pagefind is a reader feature in its
   own right, independent of agents.
2. **WebMCP:** ship the tools on the deployed site with origin-trial tokens for
   both Chrome and Edge, not only for browsers with the flag.
3. **Assistant scope:** all reading pages (articles and book chapters).
4. **Assistant models:** the browser's built-in model first, then an explicit
   WebLLM download on WebGPU browsers; never a cloud model.
5. **Article:** write it after the features ship, from real observations; until
   then the “For AI agents” page is the public explanation.

Still to settle during implementation: the WebLLM model (phase 0 spike) and the
citation-accuracy threshold for the assistant evaluation (phase 4).
