import { confirmedShareUrl, shareLinks } from "./share-links";

function mountSharing(dialog: HTMLDialogElement) {
  const full = dialog.dataset.full!;
  const short = dialog.dataset.short ?? "";
  const title = dialog.dataset.title!;
  const field = dialog.querySelector<HTMLInputElement>("input")!;
  const status = dialog.querySelector<HTMLElement>("[data-share-status]")!;
  const copy = dialog.querySelector<HTMLButtonElement>("[data-share-copy]")!;
  const device = dialog.querySelector<HTMLButtonElement>(
    "[data-share-device]",
  )!;
  let trigger: HTMLButtonElement | undefined;
  let controller: AbortController | undefined;
  let chosen = full;

  function showUrl(url: string) {
    chosen = url;
    field.value = url;
    copy.textContent = url === short ? "Copy short link" : "Copy full link";
    const links = shareLinks(title, url);
    for (const anchor of dialog.querySelectorAll<HTMLAnchorElement>(
      "[data-share-platform]",
    )) {
      const platform = anchor.dataset.sharePlatform as keyof typeof links;
      anchor.href = links[platform];
      anchor.removeAttribute("aria-disabled");
    }
    copy.disabled = false;
    device.disabled = false;
    device.hidden =
      typeof navigator.share !== "function" ||
      (typeof navigator.canShare === "function" &&
        !navigator.canShare({ title, url }));
  }

  async function open(button: HTMLButtonElement) {
    controller?.abort();
    const current = new AbortController();
    controller = current;
    trigger = button;
    showUrl(full);
    status.textContent = short
      ? "Checking the short link…"
      : "This article uses its full link.";
    copy.disabled = Boolean(short);
    device.disabled = Boolean(short);
    for (const anchor of dialog.querySelectorAll("[data-share-platform]"))
      if (short) anchor.setAttribute("aria-disabled", "true");
    dialog.showModal();
    const timeout = setTimeout(() => current.abort(), 4000);
    const url = await confirmedShareUrl(full, short, current.signal);
    clearTimeout(timeout);
    if (controller !== current || !dialog.open) return;
    showUrl(url);
    status.textContent =
      url === short
        ? "The short link is ready to share."
        : short
          ? "The short link could not be confirmed. You can share the full link below."
          : "This article uses its full link.";
  }

  dialog.addEventListener("click", (event) => {
    if ((event.target as Element).closest('[aria-disabled="true"]'))
      event.preventDefault();
  });
  dialog
    .querySelector<HTMLButtonElement>("[data-share-close]")!
    .addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", () => {
    controller?.abort();
    trigger?.focus();
  });
  field.addEventListener("click", () => field.select());
  copy.addEventListener("click", () => {
    void (async () => {
      try {
        await navigator.clipboard.writeText(chosen);
        copy.textContent = "Copied";
        status.textContent = "Link copied to the clipboard.";
      } catch {
        field.focus();
        field.select();
        status.textContent =
          "Copy was unavailable. The link is selected for you to copy.";
      }
    })();
  });
  device.addEventListener("click", () => {
    void navigator.share({ title, url: chosen }).catch((error: unknown) => {
      if (!(error instanceof DOMException && error.name === "AbortError"))
        status.textContent =
          "Device sharing was unavailable. You can copy the link instead.";
    });
  });
  for (const button of document.querySelectorAll<HTMLButtonElement>(
    `[data-share-open="${dialog.id}"]`,
  )) {
    button.hidden = false;
    button.addEventListener("click", () => void open(button));
  }
}

for (const dialog of document.querySelectorAll<HTMLDialogElement>(
  "dialog[data-article-share]",
))
  mountSharing(dialog);
