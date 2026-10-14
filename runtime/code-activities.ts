import "./code-activities.css";
import { mountPythonRunner } from "./python-runner";

export function mountCodeActivities() {
  for (const root of document.querySelectorAll<HTMLElement>(
    "[data-code-activity]",
  )) {
    mountPythonRunner(root);
  }
}
