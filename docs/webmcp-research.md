# WebMCP and agent-facing web research

Status: research saved on 23 October 2026. The resulting
[implementation plan](agent-and-browser-ai-plan.md) and its decisions were
accepted the same day; nothing is implemented yet. This note covers the state of WebMCP and related
agent-facing standards, noteworthy use cases, and options for this site, as considered before
the decisions.

Most coverage of this area is secondary and fast-moving. Facts below come from
primary sources where possible; vendor claims and third-party trackers are marked
as such. Re-check versions and dates before acting on them.

## What WebMCP is

WebMCP lets a page register _tools_ (a name, a natural-language description, a
JSON Schema for input and an `execute` callback) that an agent operating in the
browser can discover and call, instead of inferring actions from screenshots or
the DOM. Tools run in the page with the user's session, and disappear when the
page closes. Despite the name, it is not the MCP wire protocol; it is a
browser-mediated typed-function API inspired by MCP.

- **Imperative API** (current draft): `document.modelContext.registerTool(tool,
{ signal, exposedTo })`, plus `getTools()`, `executeTool()` and `toolchange`,
  `toolactivated` and `toolcancel` events. Tool `annotations` are hints:
  `readOnlyHint`, `untrustedContentHint`, `consequentialHint` and `debugging`.
  Access is gated by the `tools` Permissions Policy, defaulting to `'self'`;
  cross-origin iframes need `allow="tools"`.
  ([spec draft](https://webmachinelearning.github.io/webmcp/))
- **Declarative API**: annotate an ordinary `<form>` with `toolname` and
  `tooldescription`; describe fields with `toolparamdescription` (falling back to
  the label, then `aria-description`). Without `toolautosubmit`, the agent fills
  the form and the user presses Submit. Submit handlers see
  `SubmitEvent.agentInvoked` and can return output with `respondWith()`. The
  `:tool-form-active` and `:tool-submit-active` pseudo-classes style forms while an
  agent is using them.
  ([Chrome declarative API](https://developer.chrome.com/docs/ai/webmcp/declarative-api))
- **Naming churn**: the API moved from `navigator.modelContext` to
  `document.modelContext` in mid-2026; Chrome 150 reportedly keeps the old name
  as a deprecated alias, and Chrome 156 drops `window.ontoolactivated` and
  `window.ontoolcancel`. Code should feature-detect both locations. (Phase 0 of
  the [plan](agent-and-browser-ai-plan.md#9-phase-0-results) found
  `navigator.modelContext` absent in Chrome 156, so the site detects only
  `document.modelContext`.)
  ([report](https://byteiota.com/webmcp-chrome-150-navigator-modelcontext-deprecation/))
- **Known gaps**: no pre-visit discovery (a `.well-known` manifest is discussed in
  [issue #340](https://github.com/webmachinelearning/webmcp/issues/340) but not
  specified), and the design assumes a visible tab with a human in the loop.

## Standards and browser support

| Engine / vendor | Status (October 2026)                                                                                                                                                                                                                                                                                                                                                                                                 |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| W3C             | Draft Community Group Report (Web Machine Learning CG), revised 20 October 2026; not on the standards track. [TAG review #1238](https://github.com/w3ctag/design-reviews/issues/1238) open.                                                                                                                                                                                                                           |
| Chrome          | Flag `chrome://flags/#enable-webmcp-testing`; origin trial from Chrome 149 ([announcement](https://developer.chrome.com/blog/ai-webmcp-origin-trial)). The Intent to Experiment covered M149–M156; a third-party tracker reports an extension to M162 / 30 March 2027 that this research could not confirm on Chrome Platform Status ([feature 5117755740913664](https://chromestatus.com/feature/5117755740913664)). |
| Edge            | Listed as “ready for testing” on 21 September 2026; flag in Canary/Dev and an Edge origin trial. Copilot does not use WebMCP tools yet.                                                                                                                                                                                                                                                                               |
| Brave           | Flag in Nightly; on-by-default change for Leo pending security review (tracker).                                                                                                                                                                                                                                                                                                                                      |
| Firefox         | Mozilla position **neutral** ([#1412](https://github.com/mozilla/standards-positions/issues/1412)); hidden, disabled prototype.                                                                                                                                                                                                                                                                                       |
| Safari / WebKit | Position **oppose**, 11 June 2026 ([#670](https://github.com/WebKit/standards-positions/issues/670)).                                                                                                                                                                                                                                                                                                                 |

WebKit's objections are the most substantive critique and matter for a site that
values semantic HTML and accessibility: agent difficulties are gaps in HTML/ARIA
semantics, not a reason for a parallel JavaScript layer; agents should be treated
like assistive technology, and WebMCP makes “an agent is driving” observable, so
sites could treat agent users differently; a separate tool registry can drift from
the page, while the accessibility tree is derived from it; consent and
reversibility for consequential actions are undefined; proposed Service Worker
tools could act with no tab or human present. WebKit proposes a new community
group on agent-assisted user agents and possibly a W3C workshop.

## Agents that consume WebMCP tools

Per the [webmcp.com ecosystem tracker](https://webmcp.com/ecosystem-tracker)
(third party, updated 15 October 2026) unless otherwise noted:

- **ChatGPT desktop app browser**: site tools on by default since late August 2026,
  with an address-bar indicator distinguishing read versus change tools; not in
  Enterprise/Edu ([Search Engine Journal](https://www.searchenginejournal.com/chatgpt-adds-webmcp-support/587237/)).
- **Gemini in Chrome**: announced at Google I/O 2026 as “soon”
  ([Chrome I/O recap](https://developer.chrome.com/blog/chrome-at-io26)); the
  tracker expects early 2027.
- **Claude for Chrome**: calls tools only when explicitly asked; no automatic
  discovery. No Anthropic documentation was found.
- **Meta AI on Ray-Ban Display**: rolling out for glasses web apps, off by default;
  voice control is additive to existing navigation.
- **Automation frameworks**: Stagehand, Vercel agent-browser and Kernel use tools by
  default; Playwright, Puppeteer and Chrome DevTools MCP support them behind flags.
  Google ADK for TypeScript supports agents running inside the page.
- **No signal**: Perplexity Comet, Opera Neon, Dia.

Testing tools: Google's [Model Context Tool Inspector](https://developer.chrome.com/docs/ai/webmcp)
extension and the [example agentic extension](https://github.com/GoogleChromeLabs/webmcp-extension),
which can run entirely on-device with the Prompt API (`chrome://flags/#prompt-api-tool-use`).
Polyfill: [`@mcp-b/global`](https://docs.mcp-b.ai/packages/webmcp-polyfill/reference)
(unofficial).

## Adoption and noteworthy use cases

- **Commerce, at platform scale.** Shopify enabled storefront tools (catalog
  search, cart) on Liquid storefronts on 5 August 2026 and checkout tools on 28
  September, requiring the agent to show the order and total and ask again if the
  total changes ([TechCrunch](https://techcrunch.com/2026/09/28/shopify-opens-checkout-to-browser-based-ai-agents/)).
  Expedia, Booking.com and Target were named experimenters at I/O.
- **Edge-injected tools.** Cloudflare's developer preview (August 2026) injects a
  bridge script that registers tool “packs”, including proxies for a site's own
  MCP server at `/mcp` ([overview](https://www.openforagents.com/blog/cloudflare-webmcp-website-governance)).
  It supplies a bridge, not site-specific tools.
- **CMS plugins.** Several WordPress plugins expose content search and WooCommerce
  actions ([WP-WebMCP](https://github.com/kulkarnitech/WP-WebMCP),
  [WebMCP Bridge](https://wordpress.com/plugins/webmcp-bridge)). No Astro
  integration exists; Angular has experimental support.
- **In-page assistants on the same tools.** Projects pair WebMCP with Chrome's
  built-in Prompt API (stable since Chrome 148) so a site's own on-device assistant
  calls the same tools external agents use, with no API key or server
  ([webmcp-local-agent](https://github.com/sylwia-lask/webmcp-local-agent)). One
  personal site adds Nano-first Q&A with bio/contact tools.
- **Personal and content sites.** Examples are modest: a personal blog tool that
  finds and highlights the paragraph matching a query
  ([ricmac.org](https://ricmac.org/2026/03/11/webmcp-ai-agents-interact-website.md)),
  and a portfolio walkthrough ([suganthan.com](https://suganthan.com/blog/webmcp-implementation-guide/)).
  No major news or documentation publisher was found in production.
- **Diagnostics and complex forms.** Chrome cites developer settings pages exposing
  hidden fixes, and forms with ambiguous fields or custom date pickers.
- **Hackathon.** OpenAI's WebMCP Challenge (25 August – 3 September 2026), with
  Chrome, Shopify, Cloudflare, Vercel, Netlify and Render, produced a
  [showcase](https://openai.com/webmcp-challenge/) of agent-and-human apps.

## Security considerations

- **Tool surface poisoning**: third-party scripts on the page can register,
  remove or reframe tools mid-session, including false `readOnlyHint` claims
  ([arXiv 2606.06387](https://arxiv.org/abs/2606.06387), preprint).
- Annotations are hints, not enforcement; Google's example extension trusts them
  unconditionally.
- Tool output feeds the model, so content from readers or other sources should be
  marked `untrustedContentHint`. Consequential actions need user confirmation.
- A static site with first-party scripts only and read-only tools has a small
  surface; the local editor would not.

## Adjacent agent-facing techniques

| Technique                                                                                                                                                   | What it does                                                                                       | Evidence and status                                                                                         |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Semantic HTML, ARIA, JSON-LD                                                                                                                                | What every agent already reads (DOM, accessibility tree)                                           | Universally consumed; this site already emits JSON-LD and an RSS alternate                                  |
| Markdown alternates ([Cloudflare Markdown for Agents](https://thenewstack.io/cloudflares-markdown-for-agents-automatically-make-websites-more-aifriendly/)) | Serve Markdown on `Accept: text/markdown`; large token savings                                     | Cloudflare beta since February 2026; it also sets a default `Content-Signal` header that allows AI training |
| `llms.txt`                                                                                                                                                  | Curated Markdown index for LLMs                                                                    | ~10% adoption; log studies show major crawlers rarely fetch it; Google does not support it                  |
| [NLWeb](https://en.wikipedia.org/wiki/NLWeb)                                                                                                                | `/ask` natural-language endpoint and `/mcp` server returning Schema.org                            | Adoption flat since launch; spec v0.55                                                                      |
| Remote MCP server / MCP Apps                                                                                                                                | Site content as an MCP server usable from Claude, ChatGPT and others, with optional interactive UI | Mature client support; needs hosting beyond a static site                                                   |
| AI usage preferences ([IETF aipref](https://datatracker.ietf.org/doc/draft-ietf-aipref-attach/)), Content Signals                                           | Declare training/search/input permissions in `robots.txt` or headers                               | Drafts; signals are not technical controls                                                                  |

## Options for this site

The site is static Astro on Amplify with first-party scripts, interactive Python
activities (Pyodide), narration and audiobook players, a replaceable browser
model runtime (WebLLM) and a local-only authoring editor. Ranked by value for
effort:

1. **Generated reading index (prerequisite, useful regardless).** A build-time
   JSON index of pieces, collections, chapters and tags from the content core,
   like `rss.xml`. It serves future search, an assistant and any agent interface.
2. **Thin, read-only WebMCP layer as a labelled experiment.** Feature-detect
   `document.modelContext` (then `navigator.modelContext`) in `Layout.astro`, and
   register only tools that call the same handlers as visible controls, following
   WebKit's drift critique: `search_writing` / `list_pieces` (from the index),
   `get_book_contents`, `open_chapter`, `play_narration` (from the current
   position). Mark all `readOnlyHint`; no consequential tools. Test with the
   flag and the Tool Inspector before considering an origin-trial token.
3. **Agent-operable Python activities (most distinctive).** On chapter pages,
   expose `run_python_example` / `step_python_example` for the page's own
   activities, so an agent can run, modify and explain the examples in the
   reader's browser sandbox. This fits the explanatory books better than generic
   content retrieval; outputs from reader-edited code would carry
   `untrustedContentHint`.
4. **One tool set for the future assistant.** If the deferred site-wide assistant
   is pursued, have it call the same WebMCP-shaped tools through the Prompt API or
   the existing WebLLM runtime. External agents and the site's own assistant then
   share one interface and one set of tests.
5. **Local editor tools.** `/_author/` has real actions (checks, exports,
   short-link reservation), but coding agents already edit the files directly, and
   these tools would be consequential. Low priority.

Not recommended now: `llms.txt` (no evidence of use), NLWeb (flat adoption,
needs a server), a `.well-known/webmcp` manifest (not specified). Content
Signals or aipref headers are a publishing-policy decision, not a technical one.

An article on making this site agent-callable, including WebKit's objections, is
a natural fit for the site's writing on AI agents.

## Questions resolved by the plan

The open questions recorded here (origin-trial tokens on production, which
tools to expose, analytics, and how tools relate to visible controls) are
answered in the [plan](agent-and-browser-ai-plan.md#8-decisions): tokens for
Chrome and Edge, read/navigate and Python activity tools that each call a
visible control's handler, and consent-gated counting of tool names only.
