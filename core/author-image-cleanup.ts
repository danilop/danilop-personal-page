import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { z } from "zod";
import { readAssetManifest } from "./asset-manifest";

const day = 86400000;
export const imageCleanupPolicy = { graceDays: 7, trashDays: 30 };
const digest = (value: string | Buffer) =>
  crypto.createHash("sha256").update(value).digest("hex");
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const date = z.iso.datetime();
const assetPath = z
  .string()
  .regex(
    /^content\/(?:pieces\/[a-zA-Z0-9_-]+|collections)\/assets\/[a-zA-Z0-9_.-]+\.(?:png|jpe?g|webp|avif|gif|pdf|zip|mp3|mp4)$/,
  );
const assetSchema = z.object({
  path: assetPath,
  sha256: hash,
  created: date,
  unusedSince: date.nullable(),
  pending: z.boolean(),
});
const candidateSchema = z.object({
  id: z.uuid(),
  file: z.string(),
  created: date,
  sha256: hash,
  lastUsed: date.optional(),
});
const trashSchema = z.object({
  version: z.literal(1),
  removed: date,
  files: z.array(z.object({ from: z.string(), to: z.string(), sha256: hash })),
});
const recoverySchema = z
  .object({
    client: z.uuid(),
    names: z
      .array(z.string().regex(/^[a-zA-Z0-9_.%-]+\.(?:png|jpe?g|webp)$/i))
      .max(10000),
  })
  .strict();
const sessionSchema = recoverySchema.extend({ updated: date });
const recoveryRequest = recoverySchema
  .extend({
    session: z.uuid(),
    undoNames: recoverySchema.shape.names,
  })
  .strict();

// Conservative basename matching also protects references in retained source
// snapshots, YAML, raw HTML and encoded URLs, without interpreting provider text.
function imageReferenceNames(text: string) {
  return [
    ...new Set(
      text.match(
        /[a-zA-Z0-9_.%-]+\.(?:png|jpe?g|webp|avif|gif|pdf|zip|mp3|mp4)\b/gi,
      ) || [],
    ),
  ];
}
function candidateKeepers(records: z.infer<typeof candidateSchema>[]) {
  const keepers = new Map<string, z.infer<typeof candidateSchema>>();
  for (const record of records) {
    const previous = keepers.get(record.sha256);
    if (
      !previous ||
      Date.parse(record.lastUsed ?? record.created) >
        Date.parse(previous.lastUsed ?? previous.created)
    )
      keepers.set(record.sha256, record);
  }
  return keepers;
}

async function filesIn(folder: string): Promise<string[]> {
  let entries;
  try {
    entries = await fs.readdir(folder, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.isSymbolicLink())
      throw Error(
        "Image cleanup deferred: symbolic link in reference storage.",
      );
    const full = path.join(folder, entry.name);
    if (entry.isDirectory()) files.push(...(await filesIn(full)));
    else if (entry.isFile()) files.push(full);
  }
  return files;
}
async function readOptional(file: string) {
  try {
    return await fs.readFile(file);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export class AuthorImageCleanup {
  constructor(public root: string) {}
  get state() {
    return path.join(this.root, ".authoring-state");
  }
  async write(file: string, value: unknown) {
    await fs.mkdir(path.dirname(file), { recursive: true });
    const temp = file + ".tmp-" + crypto.randomUUID();
    try {
      await fs.writeFile(temp, JSON.stringify(value, null, 2), { flag: "wx" });
      await fs.rename(temp, file);
    } finally {
      await fs.rm(temp, { force: true });
    }
  }
  async register(
    relative: string,
    sha256: string,
    created = new Date().toISOString(),
  ) {
    const file = path.join(
      this.state,
      "image-assets",
      digest(relative) + ".json",
    );
    let record = {
      path: relative,
      sha256,
      created,
      unusedSince: null as string | null,
      pending: true,
    };
    try {
      record = {
        ...assetSchema.parse(JSON.parse(await fs.readFile(file, "utf8"))),
        created,
        pending: true,
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    await this.write(file, assetSchema.parse(record));
  }
  async recovery(raw: unknown) {
    const request = recoveryRequest.parse(raw);
    const record = recoverySchema.parse({
      client: request.client,
      names: request.names,
    });
    const recoveryFile = path.join(
      this.state,
      "image-recovery",
      record.client + ".json",
    );
    if (record.names.length) await this.write(recoveryFile, record);
    else await fs.rm(recoveryFile, { force: true });
    const sessionFile = path.join(
      this.state,
      "image-sessions",
      request.session + ".json",
    );
    if (request.undoNames.length)
      await this.write(sessionFile, {
        client: request.client,
        names: request.undoNames,
        updated: new Date().toISOString(),
      });
    else await fs.rm(sessionFile, { force: true });
    for (const file of await filesIn(path.join(this.state, "image-assets"))) {
      if (!file.endsWith(".json")) continue;
      const asset = assetSchema.parse(
        JSON.parse(await fs.readFile(file, "utf8")),
      );
      if (
        asset.pending &&
        [...record.names, ...request.undoNames].includes(
          path.basename(asset.path),
        )
      )
        await this.write(file, { ...asset, pending: false });
    }
    return { ok: true };
  }
  async touch(id: string, now = new Date().toISOString()) {
    z.uuid().parse(id);
    const file = path.join(this.state, "images", id + ".json");
    const record = JSON.parse(await fs.readFile(file, "utf8"));
    candidateSchema.parse(record);
    await this.write(file, { ...record, lastUsed: date.parse(now) });
    return { ok: true };
  }
  async sharedNames() {
    const manifest = await readAssetManifest(this.root);
    return (manifest?.shared ?? []).map((logical) => path.basename(logical));
  }
  async references(now = Date.now()) {
    const sources = [
      ...(await filesIn(path.join(this.root, "content"))),
      ...(await filesIn(path.join(this.root, "publishing"))),
      ...(await filesIn(path.join(this.root, "site"))),
      ...(await filesIn(path.join(this.root, "themes"))),
      ...(await filesIn(path.join(this.root, "runtime"))),
      ...(await filesIn(path.join(this.root, "site-assets"))),
      ...(await filesIn(path.join(this.state, "history"))),
      ...(await filesIn(path.join(this.state, "trash"))),
      ...(await filesIn(path.join(this.state, "image-recovery"))),
      ...(await filesIn(path.join(this.root, "exports"))).filter(
        (file) => path.basename(file) === "edition.json",
      ),
    ];
    const texts = new Map<string, string>();
    for (const file of sources.filter(
      (file) =>
        /\.(?:md|ya?ml|json|html|astro|[cm]?js|ts|css|txt|tex|bib)$/i.test(
          file,
        ) && file !== path.join(this.root, "publishing/media-assets.json"),
    )) {
      const text = await fs.readFile(file, "utf8");
      if (file.endsWith(".json")) {
        const record = JSON.parse(text); // Broken recovery/history defers all collection.
        if (file.startsWith(path.join(this.state, "image-recovery") + path.sep))
          recoverySchema.parse(record);
      }
      texts.set(file, text);
    }
    const names = new Set(
      [...texts.values()]
        .flatMap(imageReferenceNames)
        .concat(await this.sharedNames()),
    );
    const sessions = await filesIn(path.join(this.state, "image-sessions"));
    for (const file of sessions.filter((file) => file.endsWith(".json"))) {
      const session = sessionSchema.parse(
        JSON.parse(await fs.readFile(file, "utf8")),
      );
      if (now - Date.parse(session.updated) < day)
        for (const name of session.names) names.add(name);
    }
    const corpus = [...texts.values()].join("\n");
    const hashes = new Set<string>();
    for (const file of sources.filter((file) =>
      /\.(?:png|jpe?g|webp)$/i.test(file),
    ))
      if (names.has(path.basename(file)))
        hashes.add(digest(await fs.readFile(file)));
    return { names, hashes, corpus, texts };
  }
  async unchanged(texts: Map<string, string>) {
    const current = (await this.references()).texts;
    if (current.size !== texts.size)
      throw Error(
        "Image cleanup deferred: reference inventory changed during scan.",
      );
    for (const [file, text] of texts)
      if (current.get(file) !== text)
        throw Error("Image cleanup deferred: references changed during scan.");
  }
  async quarantine(files: string[], now: string) {
    const dir = path.join(this.state, "image-trash", crypto.randomUUID());
    await fs.mkdir(dir, { recursive: true });
    const manifest = {
      version: 1 as const,
      removed: now,
      files: [] as { from: string; to: string; sha256: string }[],
    };
    for (const file of files) {
      if ((await fs.realpath(file)) !== file)
        throw Error("Image cleanup deferred: symbolic-link asset.");
      manifest.files.push({
        from: path.relative(this.root, file),
        to: path.basename(file),
        sha256: digest(await fs.readFile(file)),
      });
    }
    await this.write(path.join(dir, "manifest.json"), manifest);
    for (const item of manifest.files)
      await fs.rename(path.join(this.root, item.from), path.join(dir, item.to));
    await fs.writeFile(path.join(dir, "complete"), "complete", { flag: "wx" });
  }
  async purge(
    now: number,
    refs: Awaited<ReturnType<AuthorImageCleanup["references"]>>,
  ) {
    const entries = (
      await filesIn(path.join(this.state, "image-trash"))
    ).filter((file) => path.basename(file) === "manifest.json");
    let purged = 0;
    for (const file of entries) {
      const record = trashSchema.parse(
        JSON.parse(await fs.readFile(file, "utf8")),
      );
      if (now - Date.parse(record.removed) < imageCleanupPolicy.trashDays * day)
        continue;
      // Matching bytes elsewhere do not make an obsolete private copy necessary.
      // A restored source reference to this actual filename does block purging.
      if (record.files.some((item) => refs.names.has(path.basename(item.from))))
        continue;
      const dir = path.dirname(file);
      try {
        await fs.access(path.join(dir, "complete"));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
        throw error;
      }
      if (!(await this.intactTrash(dir, record))) continue;
      await fs.rm(dir, { recursive: true });
      purged++;
    }
    return purged;
  }
  async intactTrash(dir: string, record: z.infer<typeof trashSchema>) {
    const expected = new Set([
      "manifest.json",
      "complete",
      ...record.files.map((item) => item.to),
    ]);
    const actual = await fs.readdir(dir);
    if (
      actual.length !== expected.size ||
      actual.some((name) => !expected.has(name))
    )
      return false;
    for (const item of record.files)
      if (
        path.basename(item.to) !== item.to ||
        digest(await fs.readFile(path.join(dir, item.to))) !== item.sha256
      )
        return false;
    return true;
  }
  async records<T>(dir: string, schema: z.ZodType<T>) {
    return Promise.all(
      (await filesIn(path.join(this.state, dir)))
        .filter((file) => file.endsWith(".json"))
        .map(async (file) => ({
          file,
          record: schema.parse(JSON.parse(await fs.readFile(file, "utf8"))),
        })),
    );
  }
  async collectAssets(
    assets: { file: string; record: z.infer<typeof assetSchema> }[],
    refs: Awaited<ReturnType<AuthorImageCleanup["references"]>>,
    now: number,
  ) {
    let removed = 0;
    for (const { file, record } of assets) {
      const full = path.join(this.root, record.path);
      const files = await this.assetFiles(full, file, record.sha256);
      if (!files.length) continue;
      const used =
        refs.names.has(path.basename(full)) ||
        refs.hashes.has(record.sha256) ||
        refs.corpus.includes(record.sha256);
      if (used) {
        if (record.unusedSince)
          await this.write(file, { ...record, unusedSince: null });
      } else if (!record.unusedSince) {
        await this.write(file, {
          ...record,
          unusedSince: new Date(now).toISOString(),
        });
      } else if (
        now - Date.parse(record.unusedSince) >=
        imageCleanupPolicy.graceDays * day
      ) {
        await this.quarantine(files, new Date(now).toISOString());
        removed++;
      }
    }
    return removed;
  }
  async assetFiles(full: string, recordFile: string, sha256: string) {
    try {
      if ((await fs.realpath(full)) !== full)
        throw Error("Image cleanup deferred: symbolic-link asset.");
      return digest(await fs.readFile(full)) === sha256
        ? [full, recordFile]
        : [];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT")
        return [recordFile];
      throw error;
    }
  }
  async collectCandidates(
    candidates: { file: string; record: z.infer<typeof candidateSchema> }[],
    refs: Awaited<ReturnType<AuthorImageCleanup["references"]>>,
    now: number,
  ) {
    let removed = 0;
    const keepers = candidateKeepers(candidates.map((item) => item.record));
    for (const { file, record } of candidates) {
      if (path.basename(file) !== record.id + ".json")
        throw Error("Invalid candidate record identity.");
      const linked =
        (refs.hashes.has(record.sha256) ||
          refs.corpus.includes(record.sha256)) &&
        keepers.get(record.sha256)?.id === record.id;
      if (
        linked ||
        now - Date.parse(record.lastUsed ?? record.created) <
          imageCleanupPolicy.graceDays * day
      )
        continue;
      const png = path.join(path.dirname(file), record.id + ".png");
      const bytes = await readOptional(png);
      if (bytes && digest(bytes) !== record.sha256) continue;
      await this.quarantine(
        bytes ? [png, file] : [file],
        new Date(now).toISOString(),
      );
      removed++;
    }
    return removed;
  }
  async collectOrphans(
    refs: Awaited<ReturnType<AuthorImageCleanup["references"]>>,
    now: number,
  ) {
    let removed = 0;
    for (const file of await filesIn(path.join(this.state, "images"))) {
      const match = /^([a-f0-9-]{36})\.png$/.exec(path.basename(file));
      if (!match || !z.uuid().safeParse(match[1]).success) continue;
      try {
        await fs.access(file.replace(/\.png$/, ".json"));
        continue;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
      if (
        now - (await fs.stat(file)).mtimeMs <
        imageCleanupPolicy.graceDays * day
      )
        continue;
      if (refs.names.has(path.basename(file))) continue;
      await this.quarantine([file], new Date(now).toISOString());
      removed++;
    }
    return removed;
  }
  async expireSessions(now: number) {
    for (const { file, record } of await this.records(
      "image-sessions",
      sessionSchema,
    ))
      if (now - Date.parse(record.updated) >= day) await fs.rm(file);
  }
  async collectTemps(now: number) {
    for (const dir of [
      "images",
      "image-assets",
      "image-recovery",
      "image-sessions",
    ])
      for (const file of await filesIn(path.join(this.state, dir))) {
        if (!/\.json\.tmp-[a-f0-9-]{36}$/.test(file)) continue;
        if (
          now - (await fs.stat(file)).mtimeMs >=
          imageCleanupPolicy.graceDays * day
        )
          await this.quarantine([file], new Date(now).toISOString());
      }
  }
  async sweep(now = Date.now(), validate?: () => Promise<void>) {
    // The server serialises sweeps with saves/insertion and defers during jobs.
    // The on-disk lock also prevents sweeps by another preview process.
    await fs.mkdir(this.state, { recursive: true });
    if ((await fs.realpath(this.state)) !== this.state)
      throw Error("Image cleanup deferred: symbolic-link state directory.");
    const lockFile = path.join(this.state, "write.lock");
    let lock;
    try {
      lock = await fs.open(lockFile, "wx");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST")
        return { deferred: true, candidates: 0, assets: 0, purged: 0 };
      throw error;
    }
    try {
      const candidates = await this.records("images", candidateSchema);
      await this.adopt(
        candidates.map((item) => item.record),
        now,
      );
      const assets = await this.records("image-assets", assetSchema);
      const refs = await this.references(now);
      for (const { record } of assets)
        if (
          refs.names.has(path.basename(record.path)) ||
          (record.pending &&
            now - Date.parse(record.created) <
              imageCleanupPolicy.graceDays * day)
        ) {
          refs.names.add(path.basename(record.path));
          refs.hashes.add(record.sha256);
        }
      // Validate every record before changing anything. Old/unknown records defer.
      await validate?.();
      await this.unchanged(refs.texts);
      const removedAssets = await this.collectAssets(assets, refs, now);
      const removedCandidates =
        (await this.collectCandidates(candidates, refs, now)) +
        (await this.collectOrphans(refs, now));
      await this.expireSessions(now);
      await this.collectTemps(now);
      await this.collectAssetCache(now);
      return {
        deferred: false,
        candidates: removedCandidates,
        assets: removedAssets,
        purged: await this.purge(now, await this.references(now)),
      };
    } finally {
      await lock.close();
      await fs.rm(lockFile, { force: true });
    }
  }
  async collectAssetCache(now: number) {
    const manifest = await readAssetManifest(this.root);
    if (!manifest) return;
    const used = new Set(
      Object.values(manifest.outputs).map((record) => record.sha256),
    );
    for (const file of await filesIn(path.join(this.root, ".asset-cache"))) {
      const match = path.basename(file).match(/^([a-f0-9]{64})\.[a-z0-9]+$/);
      if (!match || used.has(match[1])) continue;
      if (
        now - (await fs.stat(file)).mtimeMs >=
        imageCleanupPolicy.graceDays * day
      )
        await this.quarantine([file], new Date(now).toISOString());
    }
  }
  async adopt(candidates: z.infer<typeof candidateSchema>[], now: number) {
    for (const full of (await filesIn(path.join(this.root, "content"))).filter(
      (file) => /\/assets\/[a-z0-9-]+-[a-f0-9]{20}\.png$/.test(file),
    )) {
      const relative = path.relative(this.root, full);
      if (!assetPath.safeParse(relative).success) continue;
      const registry = path.join(
        this.state,
        "image-assets",
        digest(relative) + ".json",
      );
      try {
        await fs.access(registry);
        continue;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
      const sha = digest(await fs.readFile(full));
      const owner = candidates.find(
        (candidate) =>
          candidate.sha256 === sha &&
          path.dirname(path.join(this.root, candidate.file)) ===
            path.dirname(path.dirname(full)),
      );
      if (!owner || !path.basename(full).endsWith(sha.slice(0, 20) + ".png"))
        continue;
      // Migration starts a fresh grace clock, never deletes an old asset on first sight.
      await this.write(registry, {
        path: relative,
        sha256: sha,
        created: new Date(now).toISOString(),
        unusedSince: null,
        pending: false,
      });
    }
  }
}
