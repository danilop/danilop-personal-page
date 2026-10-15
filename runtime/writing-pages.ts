type LoadedPage = {
  items: HTMLElement[];
  next?: string;
  end: number;
  start: number;
};

export function mountWritingPager(
  root: HTMLElement,
  win = window,
  fetcher = fetch,
) {
  const doc = root.ownerDocument;
  const items = root.querySelector<HTMLElement>("[data-writing-items]")!;
  const button = root.querySelector<HTMLButtonElement>("[data-writing-more]")!;
  const status = root.querySelector<HTMLElement>("[data-writing-status]")!;
  const count = root.querySelector<HTMLElement>("[data-writing-count]")!;
  const nav = root.querySelector<HTMLElement>("[data-writing-navigation]")!;
  let next = nav.querySelector<HTMLAnchorElement>('[rel="next"]')?.href;
  let busy = false;
  let restoring = false;
  const base = root.dataset.base!;
  const revision = root.dataset.revision;
  const currentPage = Number(root.dataset.page);
  const originalUrl = win.location.href;
  const savedY = win.history.state?.writingY;
  const requestedStart = Number(new URL(originalUrl).searchParams.get("from"));
  const startPage =
    Number.isInteger(requestedStart) &&
    requestedStart > 0 &&
    requestedStart <= currentPage
      ? requestedStart
      : currentPage;
  const cumulative = startPage < currentPage;
  const cache = new Map<string, Promise<LoadedPage>>();

  function update() {
    button.hidden = !next;
    button.disabled = busy;
    button.textContent = busy ? "Loading articles…" : "Show more articles";
    // Retain Previous on directly opened pages; it is unnecessary for a cumulative list.
    for (const link of nav.querySelectorAll<HTMLElement>("a"))
      link.hidden = link.getAttribute("rel") === "next" || startPage === 1;
  }
  async function request(url: string): Promise<LoadedPage> {
    const target = new URL(url, win.location.href);
    if (target.origin !== win.location.origin)
      throw Error("Invalid article page");
    const response = await fetcher(target.href, {
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw Error("Article page unavailable");
    const parsed = new win.DOMParser().parseFromString(
      await response.text(),
      "text/html",
    );
    const page = parsed.querySelector<HTMLElement>("[data-writing-pager]");
    if (
      !page ||
      page.dataset.base !== base ||
      page.dataset.revision !== revision
    )
      throw Error("Article list changed; reload this page");
    const range = page
      .querySelector("[data-writing-count]")!
      .textContent.match(/(\d+)–(\d+)/)!;
    return {
      items: [...page.querySelectorAll<HTMLElement>("[data-writing-entry]")],
      next:
        page.querySelector('[rel="next"]')?.getAttribute("href") ?? undefined,
      start: Number(range[1]),
      end: Number(range[2]),
    };
  }
  function getPage(url: string) {
    if (!cache.has(url))
      cache.set(
        url,
        request(url).catch((error: unknown) => {
          cache.delete(url);
          throw error;
        }),
      );
    return cache.get(url)!;
  }
  function append(page: LoadedPage) {
    const existing = new Set(
      [...items.children].map(
        (item) => (item as HTMLElement).dataset.writingEntry,
      ),
    );
    const added = page.items.filter(
      (item) => !existing.has(item.dataset.writingEntry),
    );
    for (const item of added) items.append(doc.importNode(item, true));
    next = page.next;
    const start =
      root.dataset.cumulative === "true"
        ? 1
        : Number(count.textContent.split("–")[0]);
    count.textContent = `${start}–${page.end} of ${root.dataset.total} articles`;
    return added.length;
  }
  async function loadMore() {
    if (busy || !next) return;
    busy = true;
    status.textContent = "";
    update();
    const target = new URL(next, win.location.href);
    try {
      const page = await getPage(target.href);
      const previousCount = items.children.length;
      if (currentPage === 1 || cumulative) root.dataset.cumulative = "true";
      const added = append(page);
      target.searchParams.set("from", String(startPage));
      win.history.pushState({ writingY: win.scrollY }, "", target.href);
      status.textContent = `${added} more articles loaded. ${count.textContent}.`;
      items.children[previousCount]
        ?.querySelector<HTMLAnchorElement>("h3 a")
        ?.focus({ preventScroll: true });
    } catch {
      status.textContent =
        "Could not load articles. Try Show more again, or use Next page.";
      nav.querySelector<HTMLElement>('[rel="next"]')?.removeAttribute("hidden");
    } finally {
      busy = false;
      update();
      if (status.textContent.startsWith("Could not")) {
        const fallback = nav.querySelector<HTMLAnchorElement>('[rel="next"]');
        if (fallback && next) {
          fallback.href = next;
          fallback.hidden = false;
        }
      }
    }
  }
  async function restore() {
    if (!cumulative || currentPage < 2) return;
    busy = restoring = true;
    update();
    status.textContent = "Restoring articles…";
    try {
      const pages: LoadedPage[] = [];
      for (let page = startPage; page < currentPage; page++)
        pages.push(
          await getPage(
            new URL(page === 1 ? base : `${base}page/${page}/`, originalUrl)
              .href,
          ),
        );
      const current = [...items.children];
      items.replaceChildren();
      for (const page of pages)
        for (const item of page.items) items.append(doc.importNode(item, true));
      items.append(...current);
      root.dataset.cumulative = String(startPage === 1);
      count.textContent = count.textContent.replace(
        /^\d+–/,
        `${pages[0].start}–`,
      );
      status.textContent = "Articles restored.";
      if (Number.isFinite(savedY))
        win.scrollTo({ top: savedY, behavior: "instant" });
    } catch {
      status.textContent =
        "Earlier articles could not be restored. Reload to retry, or use Previous page.";
      nav.querySelector<HTMLElement>('[rel="prev"]')?.removeAttribute("hidden");
    } finally {
      busy = restoring = false;
      update();
      if (status.textContent.startsWith("Earlier"))
        nav
          .querySelector<HTMLElement>('[rel="prev"]')
          ?.removeAttribute("hidden");
    }
  }
  button.addEventListener("click", () => {
    void loadMore();
  });
  win.addEventListener("popstate", () => win.location.reload());
  win.addEventListener(
    "scroll",
    () => {
      if (!restoring)
        win.history.replaceState(
          { ...win.history.state, writingY: win.scrollY },
          "",
        );
    },
    { passive: true },
  );
  update();
  return { loadMore, restore };
}

export function mountWritingPages() {
  for (const root of document.querySelectorAll<HTMLElement>(
    "[data-writing-pager]",
  ))
    void mountWritingPager(root).restore();
}
