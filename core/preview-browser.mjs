import { spawn } from "node:child_process";

export function openBrowser(url, launch = spawn, platform = process.platform) {
  const command =
    platform === "darwin"
      ? "open"
      : platform === "win32"
        ? "explorer.exe"
        : "xdg-open";
  const child = launch(command, [url], { stdio: "ignore" });
  const failed = () =>
    console.warn(`Could not open the browser. Open ${url} manually.`);
  child.once("error", failed);
  child.once("exit", (code) => {
    if (code) failed();
  });
  child.unref();
}

/** The parent survives watch restarts, so the browser opens once per invocation. */
export function openWhenReady(stream, url, open = openBrowser) {
  let pending = "",
    opened = false;
  const ready = new Set([
    `Preview ready: ${url}`,
    `Read-only snapshot: ${url}`,
  ]);
  stream.setEncoding("utf8");
  stream.on("data", (text) => {
    if (opened) return;
    pending += text;
    const lines = pending.split(/\r?\n/);
    pending = lines.pop();
    for (const line of lines) {
      if (ready.has(line)) {
        opened = true;
        open(url);
        break;
      }
    }
  });
}
