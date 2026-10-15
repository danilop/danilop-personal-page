# Interactive code activities

Status: the shared runner now enhances every Python fence in web articles and books.
The 16 October 2026 update adds Copy code and Restore original; browser and release
validation are recorded in [verification](verification.md). Draft books remain private.

## Reader behaviour

One editable Python area, **Run**, **Step**, **Restore original**, **Copy code** and one output keep the
example close to its printed form. There is no numbered gutter, separate source
listing, variables panel or independent tally diagram. The tally appears naturally
in the Python program's printed output.

Each control keeps its visible label beside a decorative SVG: a play triangle for
Run, a single triangle pointing to a bar for Step, and a counterclockwise arrow
for Restore original. Copy code uses overlapping rectangles and copies the current edited source, with success or failure feedback. Step advances rather than pauses execution, so it does not use pause
bars. There is no rewind control. Icons are hidden from assistive technology;
native buttons retain their label as the accessible name, keyboard activation,
focus outline, disabled state and 44-pixel minimum targets.

A compact **About running Python** information disclosure beside the controls
expands in place without a modal or moving keyboard focus. It explains local
execution and links to the official Python and Pyodide project home pages, with
WebAssembly linked separately as the underlying technology. A brief credit
thanks the Python and Pyodide contributors. Opening it does not load the runtime
or execute code. This addition is included in this release.

**Run** shows the complete result. **Step** first records the actual editor source,
then follows its execution one line event at a time. The highlighted line runs
next; output appears after the corresponding print statement executes. Stepping
after completion starts the recording again. Run during stepping shows the final
result. Longer examples scroll inside the same editor to keep the highlighted
line visible; long lines scroll horizontally instead of wrapping. Keyboard focus
and the reader's editing selection are preserved.

The complete bounded program runs before stepping begins; it is a recording, not
an interpreter paused between clicks. Unchanged source reuses that recording.
Editing the code cancels pending execution and clears the recording, highlight
and output. **Restore original** also restores the exact article source and scroll position.
There is no extra editing mode. Changes stay in this tab and are not saved.
Python exceptions appear once, in the output, after any preceding printed text.

Every `python` fence uses these controls automatically; other languages remain static. Without JavaScript,
the original highlighted code remains visible. Book/export renditions retain that
code without browser controls. Narration continues to follow its existing code
explanation policy; these controls do not add spoken interface text.

## Authoring and source identity

Optionally place `activities.yaml` beside a piece's `index.md` to supply a reviewed title and source fingerprint. All Python fences already receive the same web behaviour
without editing canonical manuscript prose or duplicating its code:

```yaml
schemaVersion: 1
activities:
  - id: tally
    title: Make a tally
    codeSha256: REPLACE_WITH_SHA256_OF_PARSED_PYTHON_FENCE_VALUE
    runtime: python
```

Hash the parsed fence's code value as UTF-8, without the fence delimiters or an
extra trailing newline. The committed chapter sidecar contains a real hash.
Library validation requires exactly one matching `python` fence; unknown fields,
duplicate IDs/hashes, removed or changed code, and ambiguous duplicate fences
fail validation. Review changed Python
before updating the hash. Do not automatically refresh fingerprints to hide drift.

The importer updates its selected source files and preserves this local companion
file. Source changes can therefore require a deliberate sidecar review. The same
activity appears in standalone, chapter and continuous-reading web renditions;
DOM labels are scoped to each placement. The former `demo` and local prototype
`visualisation` fields are removed; remove those fields when migrating sidecars.

## Reusable implementation

- `core/code-activities.ts` validates the sidecar and exact code identity.
- `renderers/code-activity.ts` renders accessible, escaped, progressively enhanced
  markup. `core/render.ts` attaches it to every Python web fence; sidecars customise titles.
- `runtime/copy-code.ts` copies current source without affecting execution or output.
- `runtime/python-runner.ts` owns editor, reset, cancellation, deadlines and message validation.
- `runtime/python-trace.ts` uses Python `sys.settrace` to capture actual line events.
- `runtime/python-trace-player.ts` supplies reusable stepping, completion,
  highlighting within the editor and progressive output.
- `runtime/python-sandbox.ts` and `runtime/python-worker.js` isolate execution.
- `runtime/control-icons.js` and `runtime/control-icons.css` share decorative SVGs
  and the icon/label layout with article, book and private-preview audio controls.
- `runtime/code-activities.css` supplies responsive activity styling.

## Runtime, loading and isolation

The runner uses **Pyodide 314.0.7**, pinned to
`https://cdn.jsdelivr.net/pyodide/v314.0.7/full/`. This is a browser runtime
dependency, not an npm or local Python dependency. No Python runtime is downloaded
while reading. The first Run or Step downloads several megabytes
from jsDelivr; the runtime assets use the browser's ordinary HTTP cache. The notice
appears before activation. A blocked CDN or offline first run reports an error
while leaving the editor and Restore original available.

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

Editing, restoring the original, navigation and deadlines remove the frame and its Worker. There
is a 90-second loading deadline, a 10-second execution deadline, a 16,000-character
source limit and a 65,536 UTF-16-unit output limit. Recordings stop at 500 line events plus
a final snapshot. Variable values are not collected. Trace-limit and Python errors retain recorded steps and
output for inspection. These limits keep article examples small; library internals,
other threads and deliberately disabled tracing are outside the line view. Interactive `input()` is unsupported and
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
the reusable runner and recording controls, including reset during execution,
foreign messages, input limits, timeouts and errors. Real-browser evidence is
recorded in [verification](verification.md); DOM tests do not prove WASM execution.

`test/python-trace.test.ts` executes the exact tracing helper with Python to check
source edits, line semantics, function calls, output timing, Unicode, exceptions
and limits. Browser WASM checks separately verify the worker
integration. Python documents line-event semantics in
[sys.settrace](https://docs.python.org/3/library/sys.html#sys.settrace).

## Python compatibility

The canonical Chronicles examples are tested with Python 3.14 and 3.15. This does
not change the separately pinned browser Pyodide runtime. Use
`NOTES_TEST_PYTHON=/path/to/python node --import tsx --test test/python-trace.test.ts`
to exercise the actual line-recording helper with either installed interpreter.
