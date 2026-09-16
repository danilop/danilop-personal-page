for (const button of document.querySelectorAll<HTMLButtonElement>(
  ".load-embed",
))
  button.addEventListener("click", () => {
    const frame = document.createElement("iframe");
    frame.src = button.dataset.src!;
    frame.title = button.dataset.title!;
    frame.height = button.dataset.height!;
    frame.referrerPolicy = "no-referrer";
    frame.setAttribute(
      "sandbox",
      "allow-scripts allow-same-origin allow-popups",
    );
    button.parentElement!.querySelector(".embed-host")!.replaceChildren(frame);
    button.hidden = true;
  });
for (const pre of document.querySelectorAll("pre")) {
  const code = pre.querySelector("code");
  if (!code) continue;
  const button = document.createElement("button");
  button.textContent = "Copy code";
  button.className = "copy-code";
  button.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(code.textContent ?? "");
      document.dispatchEvent(new Event("notes:code-copied"));
      button.textContent = "Copied";
      setTimeout(() => (button.textContent = "Copy code"), 1500);
    } catch {
      button.textContent = "Select code to copy";
    }
  });
  pre.before(button);
}
if (document.querySelector(".experiment"))
  import("./simulations").then((m) => m.mountSimulations());
if (document.querySelector(".model-experiment"))
  import("./models").then((m) => m.mountModels());
