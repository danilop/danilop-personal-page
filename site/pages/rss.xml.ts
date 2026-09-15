import { site } from "../data";
import { siteConfig } from "../../core/config";
import { escape } from "../../core/assets";
export async function GET() {
  const config = await siteConfig();
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${escape(config.title)}</title><link>${config.url}</link><description>${escape(config.description)}</description>${site.articles.map((p) => `<item><title>${escape(p.title)}</title><link>${config.url}${p.url}</link><guid isPermaLink="false">notes-piece:${p.id}</guid><pubDate>${new Date(p.publishedAt).toUTCString()}</pubDate><description>${escape(p.summary)}</description></item>`).join("")}</channel></rss>`,
    { headers: { "Content-Type": "application/rss+xml" } },
  );
}
