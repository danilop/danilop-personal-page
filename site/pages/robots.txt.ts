import { site } from "../data";
import { siteConfig } from "../../core/config";
import { siteUrl, deployment } from "../../core/deployment.mjs";
export async function GET() {
  const config = await siteConfig();
  return new Response(
    site.isPreview
      ? `User-agent: *\nDisallow: ${deployment.basePath}\n`
      : `User-agent: *\nAllow: /\nSitemap: ${siteUrl("/sitemap.xml", config.url)}\n`,
  );
}
