import { loadEditions, editionUrl } from "../../core/editions";
import { site } from "../data";
import { siteConfig } from "../../core/config";
import { escape } from "../../core/assets";
export async function GET() {
  const config = await siteConfig();
  const paths = [
    "/",
    "/writing/",
    "/about/",
    "/archive/",
    ...site.articles.map((p) => p.url),
    ...site.collections.map((c) => c.url),
    ...(await loadEditions())
      .filter((e) => e.status === "published")
      .map(editionUrl),
  ];
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map((p) => `<url><loc>${escape(config.url + p)}</loc></url>`).join("")}</urlset>`,
    { headers: { "Content-Type": "application/xml" } },
  );
}
