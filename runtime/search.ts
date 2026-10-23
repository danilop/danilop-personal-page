type PagefindResult = {
  url: string;
  excerpt: string;
  meta: { title?: string; context?: string; date?: string };
};
type Pagefind = {
  options(options: { baseUrl: string }): Promise<void>;
  search(query: string): Promise<{
    results: { data(): Promise<PagefindResult> }[];
  } | null>;
};
type SearchHit = {
  title: string;
  url: string;
  context: string;
  excerpt: string;
};
type AgentSubmitEvent = SubmitEvent & {
  agentInvoked?: boolean;
  respondWith?(result: Promise<unknown>): void;
};

const LIMIT = 10;
let pagefind: Promise<Pagefind> | undefined;

/** Plain text of a Pagefind excerpt, which marks matches with <mark>. */
function plain(html: string) {
  const template = document.createElement("template");
  template.innerHTML = html; // inert: nothing in a template loads or runs
  return Array.from(template.content.childNodes, (n) => n.textContent).join("");
}

async function searchWriting(
  form: HTMLFormElement,
  query: string,
  limit = LIMIT,
): Promise<SearchHit[]> {
  pagefind ??= (async () => {
    const api = (await import(
      /* @vite-ignore */ form.dataset.src!
    )) as Pagefind;
    await api.options({ baseUrl: form.dataset.base ?? "/" });
    return api;
  })();
  const search = await (await pagefind).search(query);
  const results = await Promise.all(
    (search?.results ?? []).slice(0, limit).map((r) => r.data()),
  );
  return results.map((r) => ({
    title: r.meta.title ?? r.url,
    url: r.url,
    context: [r.meta.context, r.meta.date].filter(Boolean).join(" · "),
    excerpt: r.excerpt,
  }));
}

function render(list: HTMLOListElement, hits: SearchHit[]) {
  list.replaceChildren(
    ...hits.map((hit) => {
      const item = document.createElement("li");
      const heading = document.createElement("h2");
      const link = document.createElement("a");
      link.href = hit.url;
      link.textContent = hit.title;
      heading.append(link);
      const context = document.createElement("p");
      context.className = "search-context";
      context.textContent = hit.context;
      const excerpt = document.createElement("p");
      excerpt.className = "search-excerpt";
      // Pagefind escapes page text and adds only <mark> around matches.
      excerpt.innerHTML = hit.excerpt;
      item.append(heading, context, excerpt);
      return item;
    }),
  );
}

export function mountSearch(form: HTMLFormElement) {
  const input = form.querySelector<HTMLInputElement>('input[name="q"]')!;
  const status = document.querySelector<HTMLElement>("[data-search-status]")!;
  const list = document.querySelector<HTMLOListElement>(
    "[data-search-results]",
  )!;
  let latest = 0;
  async function run(query: string) {
    const ticket = ++latest;
    if (!query.trim()) {
      list.replaceChildren();
      status.textContent = "";
      return [];
    }
    status.textContent = "Searching…";
    try {
      const hits = await searchWriting(form, query);
      if (ticket !== latest) return hits;
      render(list, hits);
      status.textContent = hits.length
        ? `${hits.length === LIMIT ? "Top " : ""}${hits.length} result${hits.length === 1 ? "" : "s"} for “${query}”`
        : `No results for “${query}”`;
      return hits;
    } catch (error) {
      console.error("Search failed", error);
      if (ticket === latest)
        status.textContent = "Search could not load. Please try again.";
      throw error;
    }
  }
  form.addEventListener("submit", (event: AgentSubmitEvent) => {
    event.preventDefault();
    const query = input.value;
    const url = new URL(location.href);
    url.searchParams.set("q", query);
    history.replaceState(null, "", url);
    const pending = run(query);
    // WebMCP: return results to the agent instead of navigating.
    if (event.agentInvoked && event.respondWith)
      event.respondWith(
        pending.then((hits) =>
          hits.map((hit) => ({
            ...hit,
            url: new URL(hit.url, location.href).href,
            excerpt: plain(hit.excerpt),
          })),
        ),
      );
    else pending.catch(() => undefined);
  });
  const initial = new URLSearchParams(location.search).get("q") ?? "";
  input.value = initial;
  if (initial) run(initial).catch(() => undefined);
  else input.focus();
}
