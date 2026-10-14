import { controlIcon } from "../runtime/control-icons.js";
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
      <div data-python-editor><label class="activity-code-label">Python code <textarea data-python-code spellcheck="false" autocapitalize="off" autocomplete="off" rows="7" wrap="off" aria-describedby="${e(id)}-help">${e(code)}</textarea></label></div>
      <p id="${e(id)}-help" class="activity-help">Run the code or Step through it. First use downloads Python. Edits stay in this tab.</p>
      <div class="activity-controls"><button type="button" class="icon-label-button" data-python-run>${controlIcon("play")}<span>Run</span></button><button type="button" class="icon-label-button" data-python-step>${controlIcon("step")}<span>Step</span></button><button type="button" class="icon-label-button" data-python-reset>${controlIcon("reset")}<span>Reset</span></button></div>
      <p role="status" data-python-status>Ready to run.</p>
      <p class="activity-heading">Output</p>
      <pre class="activity-output" tabindex="0" aria-label="Python output"><samp data-python-output></samp></pre>
    </div>
    <noscript><p>Enable JavaScript to run and step through Python. The code above remains readable.</p></noscript>
  </section>`;
}
