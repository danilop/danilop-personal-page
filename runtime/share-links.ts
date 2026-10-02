/** Ordinary handoff links: platforms still require the reader to confirm posting. */
export function shareLinks(title: string, url: string) {
  const intent = (base: string, params: Record<string, string>) =>
    `${base}?${new URLSearchParams(params)}`;
  const segments = (text: string) =>
    Array.from(
      new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text),
      (s) => s.segment,
    );
  const room = Math.max(0, 300 - segments(url).length - 1);
  const shortTitle = segments(title).slice(0, room).join("");
  return {
    email: `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(`${title}\n\n${url}`)}`,
    x: intent("https://x.com/intent/tweet", { text: title, url }),
    linkedin: intent("https://www.linkedin.com/sharing/share-offsite/", {
      url,
    }),
    bluesky: intent("https://bsky.app/intent/compose", {
      text: shortTitle ? `${shortTitle}\n${url}` : url,
    }),
  };
}

export async function confirmedShareUrl(
  full: string,
  short: string,
  signal: AbortSignal,
  fetcher: typeof fetch = fetch,
) {
  if (!short) return full;
  try {
    const status = new URL(short);
    status.searchParams.set("__link_status", "1");
    const response = await fetcher(status, {
      signal,
      credentials: "omit",
      cache: "no-store",
      redirect: "error",
    });
    if (!response.ok) return full;
    const data: unknown = await response.json();
    return data &&
      typeof data === "object" &&
      "target" in data &&
      data.target === full
      ? short
      : full;
  } catch {
    return full;
  }
}
