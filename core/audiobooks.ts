import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import YAML from "yaml";
import { z } from "zod";
import { AuthorStore, revision } from "./author-store";
import { collectionSchema, loadLibrary, type Library } from "./model";
import { audiobookPlan, publicBooks, type BookPlan } from "./audiobook-plan";
import {
  bookIndex,
  bookRecordSchema,
  commitBooks,
  verifyBook,
  type BookRecord,
} from "./audiobook-store";
import { narrationLock, narrationPolicy, mp3Duration } from "./narration-store";
import { NarrationRuntime, runtimeHash } from "./narration-runtime";
import { digestAsset } from "./asset-manifest";
import { voices } from "./narration-speech";

const requestSchema = z
  .object({
    file: z.string().regex(/^content\/collections\/[a-z0-9-]+\.yaml$/),
    text: z.string().max(160000),
    revision: z.string(),
    preview: z.boolean().default(true),
  })
  .strict();
type Job = {
  id: string;
  status: "preparing" | "ready" | "failed" | "cancelled";
  progress: number;
  total: number;
  error?: string;
  record?: BookRecord;
  audioId?: string;
  saved?: { text: string; revision: string };
  controller: AbortController;
};
export class Audiobooks {
  readonly runtime: NarrationRuntime;
  private jobs = new Map<string, Job>();
  constructor(readonly root: string) {
    this.runtime = new NarrationRuntime(root);
  }
  close() {
    for (const j of this.jobs.values()) j.controller.abort();
    this.runtime.close();
  }
  async plan(id: string, preview = false, lib?: Library) {
    lib ??= await loadLibrary(path.join(this.root, "content"));
    const c = lib.collections.find((c) => c.id === id);
    if (!c) throw Error("Unknown book");
    return audiobookPlan(this.root, c, lib, preview);
  }
  async generate(
    plan: BookPlan,
    signal: AbortSignal,
    progress?: (done: number, total: number) => void,
  ) {
    if (plan.doc.issues.some((i) => !i.resolved))
      throw Error(
        "Review spoken explanations in the article Narration panels before building this book.",
      );
    const profileHash = await runtimeHash(this.root);
    if (
      (await narrationPolicy(this.root)).profiles[plan.doc.settings.profile] !==
      profileHash
    )
      throw Error(
        "Review and register the current narration runtime profile first",
      );
    const old = await verifyBook(this.root, plan).catch(() => undefined);
    if (old) return old;
    const generated = await this.runtime.generate(
      {
        ...plan.doc,
        audioMetadata: {
          title: plan.title,
          author: plan.author,
          cover: plan.cover,
        },
      },
      signal,
      progress,
    );
    const bytes = await fs.readFile(
      path.join(
        this.root,
        ".authoring-state/narration/jobs",
        generated.id,
        "audio.mp3",
      ),
    );
    if (
      digestAsset(bytes) !== generated.sha256 ||
      bytes.length !== generated.bytes ||
      Math.abs(mp3Duration(bytes) - generated.duration) > 0.2
    )
      throw Error("Generated audiobook failed audio verification");
    const logical = `content/collections/assets/audiobook-${generated.sha256}.mp3`;
    await fs.mkdir(path.join(this.root, ".asset-cache"), { recursive: true });
    await fs.writeFile(
      path.join(this.root, ".asset-cache", generated.sha256 + ".mp3"),
      bytes,
    );
    // Private preview bytes never enter versioned source or the public asset inventory.
    if (!plan.preview) {
      await fs.mkdir(path.dirname(path.join(this.root, logical)), {
        recursive: true,
      });
      await fs.writeFile(path.join(this.root, logical), bytes);
    }
    const { id: _id, done: _done, ...audio } = generated;
    return bookRecordSchema.parse({
      bookId: plan.bookId,
      title: plan.title,
      author: plan.author,
      hash: plan.hash,
      profileHash,
      profile: plan.doc.settings.profile,
      complete: plan.complete,
      partial: plan.partial,
      segments: plan.segments,
      createdAt: new Date().toISOString(),
      audio: { ...audio, path: logical },
    });
  }
  async prepare(
    id: string,
    preview = false,
    signal = new AbortController().signal,
  ) {
    const plan = await this.plan(id, preview),
      r = await this.generate(plan, signal);
    await narrationLock(this.root, async () => {
      if (signal.aborted || (await this.plan(id, preview)).hash !== plan.hash)
        throw Error(
          "Book changed during generation; refresh before publishing",
        );
      await this.save(plan, r);
    });
    return r;
  }
  private async save(plan: BookPlan, r: BookRecord) {
    if (!plan.preview) return commitBooks(this.root, [r]);
    const index = await bookIndex(this.root, true);
    index.books[plan.bookId] = r;
    const folder = path.join(this.root, ".authoring-state/audiobooks");
    await fs.mkdir(folder, { recursive: true });
    const tmp = path.join(folder, crypto.randomUUID() + ".json");
    await fs.writeFile(tmp, JSON.stringify(index));
    await fs.rename(tmp, path.join(folder, "index.json"));
  }
  async capture(raw: unknown, publish = false) {
    const request = requestSchema.parse(raw),
      saved = await new AuthorStore(this.root).read(request.file);
    if (saved.revision !== request.revision)
      throw Error("Book changed outside this editor; reload first");
    const old = collectionSchema.parse(YAML.parse(saved.text)),
      lib = await loadLibrary(path.join(this.root, "content"));
    const doc = YAML.parseDocument(request.text);
    if (publish) {
      doc.delete("status");
      doc.set("draft", false);
    }
    const text = doc.toString(),
      c = collectionSchema.parse(YAML.parse(text));
    if (c.id !== old.id) throw Error("Book identity cannot change");
    lib.collections = lib.collections.map((v) => (v.id === c.id ? c : v));
    const plan = await audiobookPlan(
      this.root,
      c,
      lib,
      publish ? false : request.preview,
    );
    return { request, saved, text, plan };
  }
  async inspect(raw: unknown) {
    const c = await this.capture(raw),
      r = await verifyBook(this.root, c.plan).catch(() => undefined);
    const previous = (await bookIndex(this.root, c.plan.preview)).books[
      c.plan.bookId
    ];
    const known = new Map(previous?.segments.map((s) => [s.id, s.contentHash]));
    return {
      plan: c.plan,
      status: r ? "Up to date" : "Needs preparation",
      voices,
      changed: c.plan.segments.filter((s) => known.get(s.id) !== s.contentHash)
        .length,
      record: r,
    };
  }
  get(id: string) {
    const j = this.jobs.get(id);
    if (!j) throw Error("Unknown audiobook job");
    const { controller: _c, ...value } = j;
    return value;
  }
  cancel(id: string) {
    const j = this.jobs.get(id);
    if (!j) throw Error("Unknown audiobook job");
    j.controller.abort();
  }
  async start(
    raw: unknown,
    mode: "prepare" | "audition" | "publish" = "prepare",
  ) {
    z.enum(["prepare", "audition", "publish"]).parse(mode);
    if ([...this.jobs.values()].some((j) => j.status === "preparing"))
      throw Error("Wait for or cancel the current audiobook job");
    const c = await this.capture(raw, mode === "publish");
    const job: Job = {
      id: crypto.randomUUID(),
      status: "preparing",
      progress: 0,
      total: c.plan.segments.length,
      controller: new AbortController(),
    };
    this.jobs.set(job.id, job);
    void this.run(c, job, mode);
    return this.get(job.id);
  }
  private async run(
    c: Awaited<ReturnType<Audiobooks["capture"]>>,
    job: Job,
    mode: string,
  ) {
    try {
      const progress = (n: number, total: number) => {
        job.progress = n;
        job.total = total;
      };
      if (mode === "audition") {
        if (!c.plan.doc.firstParagraph)
          throw Error("No opening paragraph to audition");
        const result = await this.runtime.generate(
          {
            ...c.plan.doc,
            segments: [
              {
                kind: "paragraph",
                text: c.plan.doc.firstParagraph,
                pause: 0.3,
              },
            ],
          },
          job.controller.signal,
          progress,
        );
        job.audioId = result.id;
      } else {
        job.record = await this.generate(
          c.plan,
          job.controller.signal,
          progress,
        );
        await narrationLock(this.root, async () => {
          const fresh = await this.capture(c.request, mode === "publish");
          if (job.controller.signal.aborted || fresh.plan.hash !== c.plan.hash)
            throw Error(
              "Book changed during generation; source was not published",
            );
          if (mode === "publish") {
            await commitBooks(this.root, [job.record!], {
              file: c.request.file,
              text: c.text,
            });
            job.saved = { text: c.text, revision: revision(c.text) };
          } else {
            if (!c.plan.preview && c.request.text !== c.saved.text)
              throw Error("Save changes before preparing public audio");
            await this.save(c.plan, job.record!);
          }
        });
      }
      job.status = "ready";
    } catch (error) {
      job.error = (error as Error).message;
      job.status = job.controller.signal.aborted ? "cancelled" : "failed";
    }
  }
}
export async function checkAllAudiobooks(root: string, online = false) {
  const lib = await loadLibrary(path.join(root, "content"));
  for (const c of publicBooks(lib))
    await verifyBook(root, await audiobookPlan(root, c, lib), online);
  return publicBooks(lib).length;
}
