import { siteUrl } from "./deployment.mjs";
import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { unified } from "unified";
import rehypeParse from "rehype-parse";
import rehypeRemark from "rehype-remark";
import remarkStringify from "remark-stringify";
import remarkGfm from "remark-gfm";
import { visit } from "unist-util-visit";
import { hash, safeUrl } from "./assets";
import {
  mediaPolicySchema,
  mediaProfiles,
  PortableAssets,
  portableRegistry,
  portableHtml,
  type MediaProfiles,
  type MediaReview,
} from "./distribution-media";
import {
  allowed,
  articleUrl,
  standalone,
  readYaml,
  type Piece,
  type Library,
} from "./model";
import { renderDocument } from "./render";
export const assignmentSchema = z
  .object({
    piece: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    destination: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    mode: z.enum(["full", "excerpt"]).default("full"),
    excerpt: z.string().optional(),
    creation: z.enum(["draft", "published", "manual"]).default("draft"),
    updates: z.enum(["review", "paused"]).default("review"),
    media: mediaPolicySchema.optional(),
    overrides: z
      .object({
        title: z.string().optional(),
        summary: z.string().optional(),
        tags: z.array(z.string()).optional(),
        series: z.string().optional(),
      })
      .strict()
      .default({}),
  })
  .strict();
export type Assignment = z.infer<typeof assignmentSchema>;
export type Payload = {
  title: string;
  body_markdown: string;
  canonical_url: string;
  description: string;
  tags: string[];
  series?: string;
  published: boolean;
};
export type Remote = { id: number; url: string; payload: Payload };
export type Delivery = {
  sourceRevision: string;
  payloadHash: string;
  remote?: Remote;
  intent?: { hash: string; operation: "create" | "update"; startedAt: string };
  status: "pending" | "current" | "conflict" | "failed" | "manual" | "paused";
  lastVerifiedAt?: string;
  verification?: "api" | "author";
  error?: string;
  manualUrl?: string;
};
export interface Destination {
  id: string;
  capabilities: { create: boolean; update: boolean; read: boolean };
  read(id: number): Promise<Remote>;
  find(canonical: string): Promise<Remote[]>;
  create(payload: Payload): Promise<Remote>;
  update(id: number, payload: Payload): Promise<Remote>;
}
export function normalizeRemote(raw: any): Remote {
  return {
    id: raw.id,
    url: raw.url,
    payload: {
      title: raw.title,
      body_markdown: raw.body_markdown ?? "",
      canonical_url: raw.canonical_url,
      description: raw.description ?? "",
      tags: [
        ...(Array.isArray(raw.tags)
          ? raw.tags
          : Array.isArray(raw.tag_list)
            ? raw.tag_list
            : []),
      ].sort(),
      ...(raw.series ? { series: raw.series } : {}),
      published: raw.published ?? Boolean(raw.published_at),
    },
  };
}
export function payloadHash(payload: Payload) {
  return hash(
    JSON.stringify({
      ...payload,
      body_markdown: payload.body_markdown.replace(/\r\n/g, "\n").trim(),
      tags: [...payload.tags].sort(),
    }),
  );
}
export async function exportPublication(
  piece: Piece,
  lib: Library,
  a: Assignment,
  origin: string,
  options: {
    plugin?: string;
    assetsOut?: string;
    profiles?: MediaProfiles;
  } = {},
) {
  if (!allowed(piece, "standalone"))
    throw Error("Only public standalone articles can be distributed");
  const configured =
    options.plugin ??
    (await readYaml("publishing/destinations.yaml")).destinations[a.destination]
      ?.plugin;
  const profile = (options.profiles ?? mediaProfiles()).get(configured ?? "");
  const policy = mediaPolicySchema.parse(a.media ?? {});
  const review: MediaReview[] = [];
  const canonical_url = siteUrl(articleUrl(piece), origin);
  let body: string;
  if (a.mode === "excerpt") {
    if (!a.excerpt) throw Error("Excerpt mode requires authored excerpt");
    if (policy.requiredEmbeds.length)
      throw Error("Required block embeds cannot be omitted by an excerpt");
  }
  {
    const exportedPiece =
      a.mode === "excerpt"
        ? {
            ...piece,
            body: a.excerpt!,
            ast: (await import("./model")).parser().parse(a.excerpt!),
          }
        : { ...piece, ast: structuredClone(piece.ast) };
    const definitions = new Map<string, any>();
    visit(exportedPiece.ast, "definition", (node: any) => {
      definitions.set(node.identifier, node);
    });
    visit(exportedPiece.ast, "imageReference", (node: any) => {
      const definition = definitions.get(node.identifier);
      if (!definition)
        throw Error(`Missing image definition ${node.identifier}`);
      node.type = "image";
      node.url = definition.url;
      node.title = definition.title;
      delete node.identifier;
      delete node.referenceType;
      delete node.label;
    });
    const doc = standalone(exportedPiece);
    const tokens = new Map<string, string>();
    const rendered = await renderDocument(
      doc,
      lib,
      await readYaml("publishing/renderers.yaml"),
      new PortableAssets(policy, review, options.assetsOut),
      portableRegistry(exportedPiece, profile, policy, review, tokens),
    );
    body = String(
      await unified()
        .use(rehypeParse, { fragment: true })
        .use(rehypeRemark)
        .use(remarkGfm)
        .use(remarkStringify)
        .process(portableHtml(rendered.html, canonical_url, origin, review)),
    );
    for (const [token, markdown] of tokens)
      body = body.replaceAll(token, markdown);
    for (const id of policy.requiredEmbeds)
      if (
        !review.some(
          (item) =>
            item.block === id &&
            ["embed", "embed-review"].includes(item.action),
        )
      )
        throw Error(`Required embed ${id} is absent from the exported article`);
  }
  body = body.replace(
    /\]\(\/(?!\/)([^)]+)\)/g,
    (_, p) => `](${new URL("/" + p, origin).href})`,
  );
  body = `The original article can be found [here](${canonical_url}).\n\n${body.trimStart()}`;
  body += `\n\nOriginally published at [Notes Along the Way](${canonical_url}).\n`;
  const tags = a.overrides.tags ?? piece.tags;
  if (tags.length > 4 && a.destination === "dev")
    throw Error("DEV supports four tags; specify destination overrides");
  const payload = {
    title: a.overrides.title ?? piece.title,
    description: a.overrides.summary ?? piece.summary,
    body_markdown: body,
    canonical_url,
    tags,
    series: a.overrides.series,
    published: a.creation === "published",
  } satisfies Payload;
  return {
    payload,
    profile: profile.id,
    review: review.map((item) => ({
      ...item,
      ...(item.url ? { url: new URL(item.url, origin).href } : {}),
    })),
  };
}
export async function exportPayload(
  piece: Piece,
  lib: Library,
  a: Assignment,
  origin: string,
  options: Parameters<typeof exportPublication>[4] = {},
) {
  return (await exportPublication(piece, lib, a, origin, options)).payload;
}
export function devAdapter(
  apiKey: string,
  account: string,
  request: typeof fetch = fetch,
): Destination {
  const send = async (method: string, route: string, body?: unknown) => {
    for (let attempt = 0; attempt < 3; attempt++) {
      const response = await request("https://dev.to/api" + route, {
        method,
        headers: {
          "api-key": apiKey,
          "Content-Type": "application/json",
          Accept: "application/vnd.forem.api-v1+json",
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(30000),
      });
      if (response.ok) return response.json();
      if (
        method !== "POST" &&
        (response.status === 429 || response.status >= 500) &&
        attempt < 2
      ) {
        const seconds = Math.min(
          8,
          Number(response.headers.get("retry-after")) || 2 ** attempt,
        );
        await new Promise((r) => setTimeout(r, seconds * 1000));
        continue;
      }
      throw Error(`DEV ${method} failed (${response.status})`);
    }
    throw Error("DEV retries exhausted");
  };
  const read = async (id: number) => {
    const raw = await send("GET", "/articles/" + id);
    if (raw.user?.username !== account)
      throw Error("Remote article belongs to another account");
    return normalizeRemote(raw);
  };
  return {
    id: "dev",
    capabilities: { create: true, update: true, read: true },
    read,
    async find(canonical) {
      const found: Remote[] = [];
      for (let page = 1; page <= 100; page++) {
        const records = await send(
          "GET",
          `/articles/me/all?per_page=100&page=${page}`,
        );
        if (!Array.isArray(records)) throw Error("Invalid DEV inventory");
        for (const raw of records)
          if (raw.canonical_url === canonical) found.push(await read(raw.id));
        if (records.length < 100) return found;
      }
      throw Error("DEV inventory exceeded page limit");
    },
    async create(payload) {
      const result = await send("POST", "/articles", {
        article: { ...payload, tags: payload.tags.join(",") },
      });
      return read(result.id);
    },
    async update(id, payload) {
      await send("PUT", "/articles/" + id, {
        article: { ...payload, tags: payload.tags.join(",") },
      });
      return read(id);
    },
  };
}
export const mediumAdapter: Destination = {
  id: "medium-assisted",
  capabilities: { create: false, update: false, read: false },
  async read() {
    throw Error("Medium requires manual verification");
  },
  async find() {
    return [];
  },
  async create() {
    throw Error("Use Medium import");
  },
  async update() {
    throw Error("Apply the reviewed revision in Medium");
  },
};
export async function syncCopy(
  adapter: Destination,
  payload: Payload,
  revision: string,
  previous: Delivery | undefined,
  save: (entry: Delivery) => Promise<void>,
  policy: Assignment,
  reviewed = false,
): Promise<Delivery> {
  let desired = payloadHash(payload);
  let entry: Delivery = previous ?? {
    sourceRevision: revision,
    payloadHash: "",
    status: "pending",
  };
  const persist = async (next: Delivery) => {
    entry = next;
    await save(entry);
    return entry;
  };
  if (policy.updates === "paused")
    return persist({ ...entry, status: "paused" });
  if (
    entry.status === "current" &&
    entry.verification === "author" &&
    entry.payloadHash === desired
  )
    return entry;
  if (
    !adapter.capabilities.create ||
    (!entry.remote && policy.creation === "manual")
  )
    return persist({
      ...entry,
      sourceRevision: revision,
      payloadHash: desired,
      status: "manual",
      verification: undefined,
    });
  if (entry.intent?.operation === "create" && !entry.remote) {
    const matches = await adapter.find(payload.canonical_url);
    if (matches.length === 1) {
      entry = { ...entry, remote: matches[0], intent: undefined };
      await persist(entry);
    } else
      return persist({
        ...entry,
        status: "conflict",
        error:
          "Uncertain creation: reconcile the remote post before another create attempt.",
      });
  }
  if (entry.remote) {
    const observed = await adapter.read(entry.remote.id);
    payload = { ...payload, published: observed.payload.published };
    desired = payloadHash(payload);
    if (
      entry.intent?.operation === "update" &&
      payloadHash(observed.payload) === entry.intent.hash &&
      entry.intent.hash === desired
    )
      return persist({
        sourceRevision: revision,
        payloadHash: desired,
        remote: observed,
        status: "current",
        verification: "api",
        lastVerifiedAt: new Date().toISOString(),
      });
    if (payloadHash(observed.payload) !== payloadHash(entry.remote.payload))
      return persist({
        ...entry,
        status: "conflict",
        error: "Remote copy was edited. Review before overwriting.",
      });
    if (entry.payloadHash === desired && !entry.intent)
      return persist({
        ...entry,
        status: "current",
        lastVerifiedAt: new Date().toISOString(),
        verification: "api",
      });
    if (policy.updates === "review" && !reviewed)
      return persist({
        ...entry,
        status: "pending",
        error: "Revision awaits review.",
      });
    payload = { ...payload, published: observed.payload.published };
  } else {
    const existing = await adapter.find(payload.canonical_url);
    if (existing.length)
      return persist({
        ...entry,
        status: "conflict",
        error: "An existing remote copy requires an explicit mapping.",
      });
  }
  await persist({
    ...entry,
    status: "pending",
    intent: {
      hash: desired,
      operation: entry.remote ? "update" : "create",
      startedAt: new Date().toISOString(),
    },
  });
  try {
    const remote = entry.remote
      ? await adapter.update(entry.remote.id, payload)
      : await adapter.create(payload);
    return persist({
      sourceRevision: revision,
      payloadHash: desired,
      remote,
      status: "current",
      lastVerifiedAt: new Date().toISOString(),
      verification: "api",
    });
  } catch (error) {
    await persist({ ...entry, status: "failed", error: String(error) });
    throw error;
  }
}
export async function withLedger<T>(
  root: string,
  run: (
    ledger: Record<string, Delivery>,
    save: () => Promise<void>,
  ) => Promise<T>,
) {
  await fs.mkdir(root, { recursive: true });
  const lock = path.join(root, "lock");
  let handle;
  try {
    handle = await fs.open(lock, "wx");
  } catch {
    throw Error(
      "Another delivery owns the ledger lock; inspect it before retrying.",
    );
  }
  try {
    await handle.writeFile(
      JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }),
    );
    const file = path.join(root, "ledger.json");
    let ledger: Record<string, Delivery> = {};
    try {
      ledger = JSON.parse(await fs.readFile(file, "utf8"));
    } catch (e: any) {
      if (e.code !== "ENOENT") throw e;
    }
    return await run(ledger, async () => {
      await fs.writeFile(file + ".tmp", JSON.stringify(ledger, null, 2) + "\n");
      await fs.rename(file + ".tmp", file);
    });
  } finally {
    await handle.close();
    await fs.unlink(lock);
  }
}
export async function withRemoteLedger<T>(
  bucket: string,
  run: (
    ledger: Record<string, Delivery>,
    save: () => Promise<void>,
  ) => Promise<T>,
) {
  const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } =
    await import("@aws-sdk/client-s3");
  const client = new S3Client({ region: "eu-west-1" });
  const prefix = "publication/distribution/";
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: prefix + "lock.json",
      IfNoneMatch: "*",
      Body: JSON.stringify({
        startedAt: new Date().toISOString(),
        revision: process.env.GITHUB_SHA ?? "local",
      }),
    }),
  );
  try {
    let ledger: Record<string, Delivery> = {},
      etag: string | undefined;
    try {
      const obj = await client.send(
        new GetObjectCommand({ Bucket: bucket, Key: prefix + "ledger.json" }),
      );
      ledger = JSON.parse(await obj.Body!.transformToString());
      etag = obj.ETag;
    } catch (e: any) {
      if (e.name !== "NoSuchKey") throw e;
    }
    return await run(ledger, async () => {
      const saved = await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: prefix + "ledger.json",
          Body: JSON.stringify(ledger),
          ContentType: "application/json",
          ...(etag ? { IfMatch: etag } : { IfNoneMatch: "*" }),
        }),
      );
      etag = saved.ETag;
    });
  } finally {
    await client.send(
      new DeleteObjectCommand({ Bucket: bucket, Key: prefix + "lock.json" }),
    );
  }
}
