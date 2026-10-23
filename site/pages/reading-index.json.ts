import { deployment } from "../../core/deployment.mjs";
import { site } from "../data";
import { readingIndex } from "../../core/reading-index";
// URLs are root-relative; clients prefix them with `base`.
export function GET() {
  return new Response(
    JSON.stringify({ ...readingIndex(site), base: deployment.basePath }),
    { headers: { "Content-Type": "application/json" } },
  );
}
