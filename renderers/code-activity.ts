import { escape as e } from "../core/assets";
import type { CodeActivity } from "../core/code-activities";

export function renderCodeActivity(
  activity: CodeActivity,
  code: string,
  highlighted: string,
  placement: string,
) {
  const id = `${placement}-activity-${activity.id}`;
  return `<section class="code-activity" aria-labelledby="${e(id)}" data-code-activity>
    <p class="activity-heading" id="${e(id)}">${e(activity.title)}</p>
    <div data-code-static>${highlighted}</div>
    <div data-python-controls hidden>
      <label class="activity-code-label">Python code <textarea data-python-code spellcheck="false" autocapitalize="off" autocomplete="off" rows="7" aria-describedby="${e(id)}-help">${e(code)}</textarea></label>
      <p id="${e(id)}-help" class="activity-help">Edit this example, then run it. Python loads from jsDelivr on your first run (a download of several megabytes); execution stays in your browser. Changes are not saved.</p>
      <div class="activity-controls"><button type="button" data-python-run>Run Python</button><button type="button" data-python-stop disabled>Stop</button><button type="button" data-python-reset>Reset code</button></div>
      <p role="status" data-python-status>Ready to run.</p>
      <pre class="activity-output" tabindex="0" aria-label="Python output"><samp data-python-output></samp></pre>
    </div>
    ${
      activity.demo
        ? `<div class="step-demo" data-step-demo="${activity.demo.module}" data-count="${activity.demo.count}" hidden>
      <p class="activity-heading">Watch the tally grow</p><p class="activity-help">One loop iteration adds one mark. This visual model follows the original example; edits to the Python above do not change it.</p>
      <label>Number of marks <input data-demo-count type="number" min="0" max="50" step="1" value="${activity.demo.count}"></label>
      <div class="tally-marks" data-demo-marks aria-hidden="true"></div>
      <p role="status" data-demo-status></p>
      <div class="activity-controls"><button type="button" data-demo-back>Previous step</button><button type="button" data-demo-step>Next step</button><button type="button" data-demo-play>▶ Play</button><button type="button" data-demo-reset>Reset demo</button></div>
    </div>`
        : ""
    }
    <noscript><p>Enable JavaScript to run Python or explore the visual demo. The code above remains readable.</p></noscript>
  </section>`;
}
