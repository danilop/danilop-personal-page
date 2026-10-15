import test from "node:test";
import assert from "node:assert/strict";
import { parseHTML } from "linkedom";
import { mountWritingPager } from "../runtime/writing-pages";
function markup(page: number, end = page * 2, revision = "test") {
  return `<div data-writing-pager data-base="/writing/" data-page="${page}" data-revision="${revision}" data-total="6"><div data-writing-items>${[end - 1, end].map((id) => `<article data-writing-entry="${id}"><h3><a href="/article/${id}/">Article ${id}</a></h3></article>`).join("")}</div><p data-writing-count>${end - 1}–${end} of 6 articles</p><nav data-writing-navigation>${page > 1 ? '<a rel="prev" href="/writing/">Previous page</a>' : ""}${page < 3 ? `<a rel="next" href="/writing/page/${page + 1}/">Next page</a>` : ""}</nav><button data-writing-more hidden>Show more articles</button><p data-writing-status></p></div>`;
}
function setup(page = 1, from?: number) {
  const { document, window } = parseHTML(markup(page));
  const url = new URL(
    `https://example.test/writing/${page > 1 ? `page/${page}/` : ""}${from ? `?from=${from}` : ""}`,
  );
  let state = { writingY: 123 };
  const urls: string[] = [];
  let scroll = 0;
  const listeners = new Map<string, () => void>();
  const host = {
    location: {
      href: url.href,
      origin: url.origin,
      reload() {
        urls.push("reload");
      },
    },
    DOMParser: window.DOMParser,
    history: {
      get state() {
        return state;
      },
      pushState(s: typeof state, _: string, value: string) {
        state = s;
        urls.push(value);
      },
      replaceState(s: typeof state) {
        state = s;
      },
    },
    scrollY: 321,
    scrollTo({ top }: { top: number }) {
      scroll = top;
    },
    addEventListener(name: string, callback: () => void) {
      listeners.set(name, callback);
    },
  } as unknown as Window & typeof globalThis;
  let failed = false;
  let revision = "test";
  const requests: string[] = [];
  const fetcher: typeof fetch = async (input) => {
    requests.push(String(input));
    if (failed) throw Error("Offline");
    const n = Number(String(input).match(/page\/(\d+)/)?.[1] ?? 1);
    return new Response(markup(n, n * 2, revision));
  };
  const root = document.querySelector<HTMLElement>("[data-writing-pager]")!;
  const controller = mountWritingPager(root, host, fetcher);
  return {
    controller,
    root,
    urls,
    requests,
    listeners,
    get scroll() {
      return scroll;
    },
    fail(value: boolean) {
      failed = value;
    },
    revision(value: string) {
      revision = value;
    },
  };
}
test("load more appends once, announces results, saves addressable state and hides exhausted controls", async () => {
  const f = setup();
  await Promise.all([f.controller.loadMore(), f.controller.loadMore()]);
  assert.equal(f.requests.length, 1);
  assert.equal(f.root.querySelectorAll("article").length, 4);
  assert.equal(f.urls[0], "https://example.test/writing/page/2/?from=1");
  assert.match(
    f.root.querySelector("[data-writing-status]")!.textContent,
    /2 more articles loaded/,
  );
  await f.controller.loadMore();
  assert.equal(f.root.querySelectorAll("article").length, 6);
  assert.equal(f.root.querySelector<HTMLButtonElement>("button")!.hidden, true);
  await f.controller.loadMore();
  assert.equal(f.requests.length, 2);
  f.listeners.get("scroll")!();
  f.listeners.get("popstate")!();
  assert.equal(f.urls.at(-1), "reload");
});
test("network failure permits a retry and exposes the correct ordinary next link", async () => {
  const f = setup();
  f.fail(true);
  await f.controller.loadMore();
  assert.equal(f.root.querySelectorAll("article").length, 2);
  assert.match(
    f.root.querySelector("[data-writing-status]")!.textContent,
    /Could not load/,
  );
  assert.equal(
    f.root.querySelector<HTMLElement>('[rel="next"]')!.hidden,
    false,
  );
  f.fail(false);
  await f.controller.loadMore();
  assert.equal(f.root.querySelectorAll("article").length, 4);
});
test("reload/back reconstruction restores earlier pages and scroll; direct pages retain previous navigation", async () => {
  const f = setup(3, 1);
  await f.controller.restore();
  assert.deepEqual(
    [...f.root.querySelectorAll<HTMLElement>("article")].map(
      (n) => n.dataset.writingEntry,
    ),
    ["1", "2", "3", "4", "5", "6"],
  );
  assert.equal(f.scroll, 123);
  assert.equal(
    f.root.querySelector("[data-writing-count]")!.textContent,
    "1–6 of 6 articles",
  );
  const direct = setup(2);
  await direct.controller.restore();
  assert.equal(direct.requests.length, 0);
  assert.equal(
    direct.root.querySelector<HTMLElement>('[rel="prev"]')!.hidden,
    false,
  );
  await direct.controller.loadMore();
  assert.equal(direct.urls[0], "https://example.test/writing/page/3/?from=2");
  const later = setup(3, 2);
  await later.controller.restore();
  assert.equal(
    later.root.querySelector("[data-writing-count]")!.textContent,
    "3–6 of 6 articles",
  );
});
test("restoration failure leaves the current page intact; mismatched builds never mix stale articles", async () => {
  const f = setup(3, 1);
  f.fail(true);
  await f.controller.restore();
  assert.equal(f.root.querySelectorAll("article").length, 2);
  assert.equal(
    f.root.querySelector<HTMLElement>('[rel="prev"]')!.hidden,
    false,
  );
  const stale = setup();
  stale.revision("other-build");
  await stale.controller.loadMore();
  assert.equal(stale.root.querySelectorAll("article").length, 2);
  assert.match(
    stale.root.querySelector("[data-writing-status]")!.textContent,
    /Could not/,
  );
});
