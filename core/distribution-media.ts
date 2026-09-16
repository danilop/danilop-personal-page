import sharp from "sharp";
import { z } from "zod";
import { load } from "cheerio";
import { Assets, escape as e, safeUrl } from "./assets";
import type { Piece } from "./model";
import { registry, publicEmbed } from "../renderers/static";
import { Registry, type Request } from "../renderers/registry";

export const mediaPolicySchema = z
  .object({
    imageWidth: z.number().int().min(640).max(3200).default(1600),
    embeds: z.enum(["prefer", "require", "fallback"]).default("prefer"),
    requiredEmbeds: z.array(z.string()).default([]),
    verifiedEmbeds: z.array(z.string().url()).default([]),
  })
  .strict();
export type MediaPolicy = z.infer<typeof mediaPolicySchema>;
export type MediaReview = {
  block?: string;
  action: "png" | "embed" | "embed-review" | "fallback" | "external-image";
  source?: string;
  url?: string;
  detail: string;
};
export type MediaProfile = {
  id: string;
  embed(
    url: URL,
    format: string,
  ): { markdown: string; needsReview: boolean } | undefined;
};
function videoProvider(u: URL) {
  return (
    ((u.hostname === "www.youtube.com" || u.hostname === "youtube.com") &&
      u.pathname === "/watch" &&
      /^[A-Za-z0-9_-]+$/.test(u.searchParams.get("v") ?? "")) ||
    (u.hostname === "youtu.be" && /^\/[A-Za-z0-9_-]+$/.test(u.pathname)) ||
    (u.hostname === "vimeo.com" && /^\/\d+$/.test(u.pathname))
  );
}
export class MediaProfiles {
  private profiles = new Map<string, MediaProfile>();
  register(profile: MediaProfile) {
    if (this.profiles.has(profile.id))
      throw Error(`Duplicate media profile ${profile.id}`);
    this.profiles.set(profile.id, profile);
    return this;
  }
  get(id: string) {
    const profile = this.profiles.get(id);
    if (!profile) throw Error(`No media profile for destination plugin ${id}`);
    return profile;
  }
}
export function mediaProfiles() {
  return new MediaProfiles()
    .register({
      id: "dev",
      embed: (url) =>
        videoProvider(url)
          ? { markdown: `{% embed ${url.href} %}`, needsReview: false }
          : undefined,
    })
    .register({
      id: "medium-assisted",
      embed: (url, format) =>
        videoProvider(url) ||
        ["google-docs-published", "google-slides-published"].includes(format)
          ? { markdown: url.href, needsReview: true }
          : undefined,
    });
}

/** Only authored local assets are rasterized. Remote URLs are not fetched here. */
export class PortableAssets extends Assets {
  constructor(
    public policy: MediaPolicy,
    public review: MediaReview[],
    out?: string,
  ) {
    super(out);
  }
  override async emit(data: Uint8Array | string, extension: string) {
    if (!/^\.(svg|png|jpe?g|webp|avif|tiff?|gif|heif|heic)$/i.test(extension))
      return super.emit(data, extension);
    let input =
      typeof data === "string" ? Buffer.from(data) : Buffer.from(data);
    if (
      extension.toLowerCase() === ".svg" &&
      /<foreignObject\b|<script\b|<!ENTITY|\bon\w+\s*=|(?:href|src)\s*=\s*["'](?:https?:|file:|\/\/)/i.test(
        input.toString(),
      )
    )
      throw Error(
        "Portable SVG must be self-contained, with native text and no active content",
      );
    if (extension.toLowerCase() === ".svg") {
      // Mermaid splits words into adjacent identical spans. Merge them so SVG
      // rasterizers preserve the spaces between words consistently.
      const svg = load(input.toString(), { xmlMode: true });
      svg("tspan.text-outer-tspan").each((_, outer) => {
        let previous: typeof outer | undefined;
        for (const span of [...outer.children]) {
          if (
            span.type !== "tag" ||
            span.name !== "tspan" ||
            !span.children.every((child) => child.type === "text")
          ) {
            previous = undefined;
            continue;
          }
          if (
            previous &&
            JSON.stringify(previous.attribs) === JSON.stringify(span.attribs)
          ) {
            svg(previous).text(svg(previous).text() + svg(span).text());
            svg(span).remove();
          } else previous = span;
        }
      });
      input = Buffer.from(svg.xml());
    }
    const image = sharp(input, { density: 144, limitInputPixels: 40_000_000 });
    const metadata = await image.metadata();
    if ((metadata.pages ?? 1) > 1)
      throw Error(
        "Animated/multipage images require an authored static export",
      );
    const png = await image
      .rotate()
      .resize({ width: this.policy.imageWidth, withoutEnlargement: true })
      .flatten({ background: "#ffffff" })
      .png()
      .toBuffer();
    const url = await super.emit(png, ".png");
    if (!this.review.some((item) => item.action === "png" && item.url === url))
      this.review.push({
        action: "png",
        source: extension,
        url,
        detail: `PNG, white background, maximum width ${this.policy.imageWidth}px; identity follows output bytes.`,
      });
    return url;
  }
}

export function portableRegistry(
  piece: Piece,
  profile: MediaProfile,
  policy: MediaPolicy,
  review: MediaReview[],
  tokens: Map<string, string>,
) {
  const base = registry(),
    result = new Registry();
  for (const id of policy.requiredEmbeds) {
    if (!piece.blocks[id]) throw Error(`Unknown required embed block ${id}`);
    if (
      ![
        "document",
        "presentation",
        "audio",
        "video",
        "gallery",
        "simulation",
        "model-experiment",
      ].includes(piece.blocks[id].kind)
    )
      throw Error(`Required embed ${id} is not an embeddable block`);
  }
  const token = (markdown: string) => {
    const key = `NOTESMEDIA${tokens.size}END`;
    if (piece.body.includes(key))
      throw Error("Reserved media placeholder in article source");
    tokens.set(key, markdown);
    return { html: `<p>${key}</p>` };
  };
  for (const plugin of base.plugins.values())
    result.register({
      ...plugin,
      render: async (r: Request) => {
        const block = Object.entries(piece.blocks).find(
          ([, value]) => value === r.block,
        )?.[0];
        if (r.block.kind === "image") {
          const source = r.block.source.path;
          if (typeof source !== "string")
            throw Error("Image requires a local source path");
          const url = await r.assets.copy(r.owner, source);
          const alt = r.block.description ?? r.block.summary;
          if (!alt) throw Error("Image requires alternative text");
          return { html: `<img src="${e(url)}" alt="${e(alt)}"/>`, asset: url };
        }
        if (
          ![
            "document",
            "presentation",
            "audio",
            "video",
            "gallery",
            "simulation",
            "model-experiment",
          ].includes(r.block.kind)
        )
          return plugin.render(r);
        const format = String(r.block.source.format);
        let url: string | undefined;
        if (typeof r.block.source.url === "string") {
          url = format.startsWith("google-")
            ? publicEmbed(format, r.block.source.url)
            : safeUrl(r.block.source.url);
          const parsed = new URL(url);
          if (
            parsed.protocol !== "https:" ||
            parsed.username ||
            parsed.password ||
            /[{}\s]/.test(url)
          )
            throw Error(
              "Cross-post embeds require a public HTTPS URL without credentials",
            );
        }
        const required =
          policy.embeds === "require" ||
          Boolean(block && policy.requiredEmbeds.includes(block));
        const embed =
          url && policy.embeds !== "fallback"
            ? profile.embed(new URL(url), format)
            : undefined;
        if (
          embed &&
          (!required ||
            !embed.needsReview ||
            policy.verifiedEmbeds.includes(url!))
        ) {
          review.push({
            block,
            action: embed.needsReview ? "embed-review" : "embed",
            url,
            detail: embed.needsReview
              ? "Paste this URL on its own line in the destination editor, press Enter, and verify the live viewer before completing the copy."
              : "Native destination embed syntax; verify the rendered draft before first publication.",
          });
          return token(embed.markdown);
        }
        if (required)
          throw Error(
            `Required embed ${block ?? r.block.kind} is unsupported or lacks exact-URL editor verification on ${profile.id}`,
          );
        if (!r.block.alternative)
          throw Error(
            `Cross-post fallback required for ${block ?? r.block.kind} on ${profile.id}`,
          );
        // Reuse the authored alternative, not the book's renderer selection or document target.
        const rendered = await plugin.render({ ...r, target: "book" });
        const destination = r.block.alternative.url ?? url;
        if (!destination)
          throw Error(
            `Cross-post fallback requires a companion URL for ${block ?? r.block.kind}`,
          );
        const parsed = new URL(safeUrl(destination));
        if (parsed.protocol !== "https:" || parsed.username || parsed.password)
          throw Error("Fallback links require public HTTPS URLs");
        if (!r.block.alternative.url)
          rendered.html += `<p><a href="${e(destination)}">Open ${e(r.block.title ?? "companion content")}</a></p>`;
        review.push({
          block,
          action: "fallback",
          url: destination,
          detail: `${policy.embeds === "fallback" ? "Static delivery selected" : "No supported native embed"}; authored ${r.block.alternative.mode} alternative retained.`,
        });
        return rendered;
      },
    });
  return result;
}

/** Retain figure destinations in the canonical site; platform heading rules differ. */
export function portableHtml(
  html: string,
  canonical: string,
  origin: string,
  review: MediaReview[],
) {
  const $ = load(html, {}, false);
  $("a[href^='#']").each((_, element) => {
    $(element).attr("href", canonical + $(element).attr("href"));
  });
  $("img").each((_, element) => {
    const node = $(element),
      src = node.attr("src"),
      alt = node.attr("alt");
    if (!src || !alt)
      throw Error("Every cross-post image requires a URL and alternative text");
    const url = new URL(src, origin);
    if (url.protocol !== "https:" || url.username || url.password)
      throw Error("Cross-post images require public HTTPS URLs");
    node.attr("src", url.href);
    if (!src.startsWith("/media/"))
      review.push({
        action: "external-image",
        url: url.href,
        detail:
          "Authored remote image retained without fetching or format conversion; destination rendering and cache behavior require verification.",
      });
  });
  // Avoid figcaption disappearing or joining the next paragraph during HTML -> Markdown.
  $("figcaption").each((_, element) => {
    $(element).replaceWith(`<p>${$(element).html()}</p>`);
  });
  return $.html();
}
