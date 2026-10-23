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
  button.addEventListener("click", () => {
    void (async () => {
      try {
        await navigator.clipboard.writeText(code.textContent ?? "");
        document.dispatchEvent(new Event("notes:code-copied"));
        button.textContent = "Copied";
        setTimeout(() => (button.textContent = "Copy code"), 1500);
      } catch {
        button.textContent = "Select code to copy";
      }
    })().catch((error: unknown) => {
      button.textContent = "Select code to copy";
      console.error(error);
    });
  });
  pre.before(button);
}
const searchForm = document.querySelector<HTMLFormElement>("[data-search]");
if (searchForm)
  import("./search")
    .then((m) => m.mountSearch(searchForm))
    .catch((error: unknown) => console.error("Could not load search", error));
const modelContext = (document as { modelContext?: object }).modelContext;
if (modelContext)
  import("./agent-tools/webmcp")
    .then((m) =>
      m.mountWebMcp(modelContext as Parameters<typeof m.mountWebMcp>[0]),
    )
    .catch((error: unknown) =>
      console.error("Could not load agent tools", error),
    );
// "/" opens search from any page, unless the reader is typing.
document.addEventListener("keydown", (event) => {
  const { target } = event;
  if (
    event.key !== "/" ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    (target instanceof Element &&
      target.closest("input, textarea, select, [contenteditable]"))
  )
    return;
  const link = document.querySelector<HTMLAnchorElement>("a[data-search-link]");
  if (!link) return;
  event.preventDefault();
  if (searchForm)
    searchForm.querySelector<HTMLInputElement>('input[name="q"]')?.focus();
  else location.assign(link.href);
});
if (document.querySelector(".experiment"))
  import("./simulations")
    .then((m) => m.mountSimulations())
    .catch((error: unknown) =>
      console.error("Could not load simulations", error),
    );
if (document.querySelector(".model-experiment"))
  import("./models")
    .then((m) => m.mountModels())
    .catch((error: unknown) => console.error("Could not load models", error));
if (document.querySelector("[data-code-activity]"))
  import("./code-activities")
    .then((m) => m.mountCodeActivities())
    .catch((error: unknown) =>
      console.error("Could not load code activities", error),
    );
