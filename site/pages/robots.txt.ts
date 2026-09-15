export function GET() {
  return new Response(
    "User-agent: *\nAllow: /\nSitemap: https://www.danilop.net/sitemap.xml\n",
  );
}
