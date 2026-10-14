import "./code-activities.css";
import { mountPythonRunner } from "./python-runner";
import { mountStepDemo } from "./step-demos";

export function mountCodeActivities() {
  for (const root of document.querySelectorAll<HTMLElement>(
    "[data-code-activity]",
  )) {
    mountPythonRunner(root);
    const demo = root.querySelector<HTMLElement>("[data-step-demo]");
    if (demo) mountStepDemo(demo);
  }
}
