/** Per-device switch on the "For AI agents" page; tools are on by default. */
const KEY = "notes.agent-tools.v1";
export function agentToolsEnabled() {
  try {
    return localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}
export function setAgentToolsEnabled(enabled: boolean) {
  try {
    if (enabled) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, "off");
  } catch {
    return false;
  }
  document.dispatchEvent(new Event("notes:agent-tools-setting"));
  return true;
}
