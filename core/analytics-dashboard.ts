/** Resolve operator-maintained links without putting account IDs in the repository. */
export function analyticsDashboardUrl(
  note: string,
  target = "traffic",
): string {
  if (!["traffic", "collections", "dashboards"].includes(target))
    throw new Error("Choose traffic, collections or dashboards.");
  const section = note.match(
    /^## PostHog\s*\r?\n([\s\S]*?)(?=^## |$(?![\s\S]))/m,
  )?.[1];
  const label = target === "collections" ? "Collections/books" : "Traffic";
  const links = section
    ?.split(/\r?\n/)
    .filter((line) => line.startsWith(`- ${label}: `))
    .map((line) => line.match(/\]\((https:\/\/[^\s)]+)\)/)?.[1]);
  if (links?.length !== 1 || !links[0])
    throw new Error(
      `Keep exactly one '- ${label}: [name](URL)' entry under '## PostHog' in the private operations note. See docs/private-operations.md.`,
    );
  const url = new URL(links[0]);
  const route = url.pathname.match(/^\/project\/(\d+)\/dashboard\/\d+\/?$/);
  if (
    url.origin !== "https://eu.posthog.com" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !route
  )
    throw new Error(
      "Expected a plain HTTPS PostHog EU project/dashboard URL in the private operations note.",
    );
  return target === "dashboards"
    ? `${url.origin}/project/${route[1]}/dashboard`
    : url.href;
}
