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
      <div class="activity-toolbar">
        <div class="activity-controls"><button type="button" class="icon-label-button" data-python-run>${controlIcon("play")}<span>Run</span></button><button type="button" class="icon-label-button" data-python-step>${controlIcon("step")}<span>Step</span></button><button type="button" class="icon-label-button" data-python-reset>${controlIcon("reset")}<span>Reset</span></button></div>
        <details class="activity-about">
          <summary aria-label="About running Python" title="About running Python"><svg aria-hidden="true" focusable="false" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M12 11v6" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="7" r="1.2" fill="currentColor"/></svg></summary>
          <div class="activity-about-content">
            <p>This runs real <a href="https://www.python.org/">Python</a> in your browser using <a href="https://pyodide.org/">Pyodide</a>, built on <a href="https://webassembly.org/">WebAssembly</a>. Your code runs on your device, not on our server.</p>
            <p>Thanks to the Python and Pyodide contributors who make this possible.</p>
          </div>
        </details>
      </div>
      <p role="status" data-python-status>Ready to run.</p>
      <p class="activity-heading">Output</p>
      <pre class="activity-output" tabindex="0" aria-label="Python output"><samp data-python-output></samp></pre>
    </div>
    <noscript><p>Enable JavaScript to run and step through Python. The code above remains readable.</p></noscript>
  </section>`;
}
