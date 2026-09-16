import { load } from "cheerio";
import { sitePath, deployment } from "./deployment.mjs";

/** Apply the deployment base at the HTML boundary, keeping content IDs/paths portable. */
export function deploymentHtml(html: string, base = deployment.basePath) {
  if (base === "/") return html;
  const $ = load(html);
  for (const attribute of ["href", "src", "poster", "action", "data-src"]) {
    $(`[${attribute}]`).each((_, element) => {
      const value = $(element).attr(attribute)!;
      $(element).attr(attribute, sitePath(value, base));
    });
  }
  $("[srcset]").each((_, element) => {
    const value = $(element).attr("srcset")!;
    // Only rewrite root-relative candidates; preserve data and external URLs.
    $(element).attr(
      "srcset",
      value.replace(
        /(^|,\s*)(\/(?!\/)[^\s,]+)/g,
        (_, separator, url) => separator + sitePath(url, base),
      ),
    );
  });
  return $.html();
}
