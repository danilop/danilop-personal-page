# Interactive code activities

Status: implemented and tested locally on 14 October 2026. All 26 repository checks
passed, with 338 tests passing and one opt-in AWS test skipped. Real Chromium
desktop/mobile execution and isolation checks passed. The components are included
in the 14 October 2026 release. The first activity belongs to the draft Chronicles
chapter **Before Written Arithmetic**; it remains private until explicitly published.

## Reader behaviour

An opted-in Python listing offers an editable, labelled text area, Run Python,
Stop, Reset code, a status message and a bounded output panel. Run executes the
actual Python shown in the editor. **Reset code stops execution, restores the
exact original article sample and clears output.** Reader edits are temporary;
they are not saved to browser storage, sent to an application server, or applied
to the manuscript. Reset and Stop also work while the runtime is loading.

The optional visual demo explains the original algorithm independently of reader
edits. The tally demo lets readers choose 0–50 marks, step forward/backward,
play/pause, and reset. Each step adds one mark and reports the current string
length. Reset demo restores the original count and step zero; changing the count
also starts at zero. Animation begins only on request and pauses in a hidden tab.
The panel explicitly explains that editing Python does not reprogram the diagram.

Ordinary code fences remain static unless explicitly selected. Without JavaScript,
the original highlighted code remains visible. Book/export renditions retain that
code without browser controls. Narration continues to follow its existing code
explanation policy; these controls do not add spoken interface text.

## Authoring and source identity

Place `activities.yaml` beside a piece's `index.md`. This attaches web behaviour
without editing canonical manuscript prose or duplicating its code:

```yaml
schemaVersion: 1
activities:
  - id: tally
    title: Make a tally
    codeSha256: REPLACE_WITH_SHA256_OF_PARSED_PYTHON_FENCE_VALUE
    runtime: python
    demo:
      module: tally
      count: 10
```

Hash the parsed fence's code value as UTF-8, without the fence delimiters or an
extra trailing newline. The committed chapter sidecar contains a real hash.
Library validation requires exactly one matching `python` fence; unknown fields,
duplicate IDs/hashes, invalid counts, removed or changed code, and ambiguous
duplicate fences fail validation. Review changed Python and its visual explanation
before updating the hash. Do not automatically refresh fingerprints to hide drift.

The importer updates its selected source files and preserves this local companion
file. Source changes can therefore require a deliberate sidecar review. The same
activity appears in standalone, chapter and continuous-reading web renditions;
DOM labels are scoped to each placement. Omit `demo` for a Python-only activity.

## Reusable implementation

- `core/code-activities.ts` validates the sidecar and exact code identity.
- `renderers/code-activity.ts` renders accessible, escaped, progressively enhanced
  markup. `core/render.ts` attaches it only to the selected web fence.
- `runtime/python-runner.ts` owns editor, reset, cancellation, limits and output.
- `runtime/python-sandbox.ts` and `runtime/python-worker.js` isolate execution.
- `runtime/step-demos.ts` supplies shared stepping/playback controls and a registry
  of visual models. Add a model there and extend the sidecar schema deliberately;
  do not introduce article-ID-specific branches.
- `runtime/code-activities.css` supplies shared responsive styling.

## Runtime, loading and isolation

The runner uses **Pyodide 314.0.7**, pinned to
`https://cdn.jsdelivr.net/pyodide/v314.0.7/full/`. This is a browser runtime
dependency, not an npm or local Python dependency. No Python runtime is downloaded
while reading or using the visual demo. The first Run downloads several megabytes
from jsDelivr; the runtime assets use the browser's ordinary HTTP cache. The notice
appears before activation. A blocked CDN or offline first run reports an error
while leaving the editable code and visual demo usable.

Each run starts a fresh module Worker inside an iframe sandboxed with
`allow-scripts` **without** `allow-same-origin`. Python/JavaScript interop cannot
reach the article's DOM or origin storage. The frame's CSP permits scripts and
runtime fetches only from the pinned Pyodide directory plus its local data-URL Worker;
other network destinations, forms, nested frames and base URLs are blocked.
Messages are accepted only from the current frame. Results are inserted as text.
The data-URL bootstrap is deliberate: Chromium rejected module blob Workers in
the opaque frame during testing; the data-URL module Worker retained isolation
and passed actual Python execution and blocked-network checks.
This is an isolation boundary; the Worker alone would not provide one.

Stop, Reset code, navigation and deadlines remove the frame and its Worker. There
is a 90-second loading deadline, a 10-second execution deadline, a 16,000-character
source limit and a 64 KiB output limit. Interactive `input()` is unsupported and
explains how to replace it with an assignment. No package auto-installation occurs.
There is no reliable per-Worker memory quota; this is an educational runner, not
a general hosted execution service. No shared-memory headers are required.

Runtime upgrades are deliberate: update the worker URL and sandbox CSP together,
then rerun actual-browser execution, errors, cancellation, reset, isolation,
mobile layout and static/book fallback checks. An npm audit does not inspect this
CDN dependency. Official guidance: [Pyodide in a Web Worker](https://pyodide.org/en/stable/usage/webworker.html).

## Validation

`test/code-activities.test.ts` covers source matching, schema rejection, escaping,
library loading and web-versus-book rendering. `test/runtime-dom.test.js` covers
the reusable runner and visual controls, including reset during execution,
foreign messages, input limits, timeouts and errors. Real-browser evidence is
recorded in [verification](verification.md); DOM tests do not prove WASM execution.
