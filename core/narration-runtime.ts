import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import path from "node:path";
import readline from "node:readline";
import fs from "node:fs/promises";
import crypto from "node:crypto";
import { z } from "zod";
import type { SpeechDocument } from "./narration-speech";
import { digestAsset } from "./asset-manifest";

export const generatedSchema = z.object({
  id: z.string().uuid(),
  done: z.literal(true),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  bytes: z.number().int().positive(),
  duration: z.number().positive().finite(),
  timings: z.array(
    z.object({ start: z.number().nonnegative(), end: z.number().positive() }),
  ),
  reusedChunks: z.number().int().nonnegative(),
  generationSeconds: z.number().nonnegative(),
});
export type GeneratedNarration = z.infer<typeof generatedSchema>;
export async function runtimeHash(root: string) {
  return digestAsset(
    Buffer.concat(
      await Promise.all(
        ["profile.json", "requirements.txt", "worker.py"].map((name) =>
          fs.readFile(path.join(root, "tools/narration", name)),
        ),
      ),
    ),
  );
}
/** One warm worker, serial bounded queue. Cancellation kills inference and resets it. */
export class NarrationRuntime {
  private child?: ChildProcessWithoutNullStreams;
  private tail: Promise<unknown> = Promise.resolve();
  private pending = 0;
  private receiver?: (message: unknown) => void;
  private failed?: (error: Error) => void;
  private idle?: ReturnType<typeof setTimeout>;
  constructor(readonly root: string) {}
  close() {
    clearTimeout(this.idle);
    const child = this.child;
    child?.kill();
    if (child) setTimeout(() => child.kill("SIGKILL"), 1500).unref();
    this.child = undefined;
  }
  generate(
    doc: SpeechDocument,
    signal: AbortSignal,
    progress: (done: number, total: number) => void = () => {},
  ) {
    if (this.pending >= 8)
      return Promise.reject(
        Error("Narration queue is full; wait for a job to finish"),
      );
    this.pending++;
    const task = this.tail
      .catch(() => {})
      .then(() => this.execute(doc, signal, progress));
    this.tail = task;
    return task.finally(() => {
      this.pending--;
    });
  }
  private async execute(
    doc: SpeechDocument,
    signal: AbortSignal,
    progress: (done: number, total: number) => void,
  ) {
    if (signal.aborted) throw Error("Narration cancelled");
    const profileHash = await runtimeHash(this.root);
    clearTimeout(this.idle);
    return new Promise<GeneratedNarration>((resolve, reject) => {
      const id = crypto.randomUUID();
      let stderr = "",
        settled = false;
      const finish = (error?: Error, result?: GeneratedNarration) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        signal.removeEventListener("abort", cancel);
        this.receiver = undefined;
        this.failed = undefined;
        this.idle = setTimeout(() => this.close(), 5 * 60_000);
        this.idle.unref();
        if (error) reject(error);
        else resolve(result!);
      };
      const cancel = () => {
        finish(Error("Narration cancelled"));
        this.close();
      };
      const timer = setTimeout(() => {
        finish(Error("Narration timed out"));
        this.close();
      }, 30 * 60_000);
      signal.addEventListener("abort", cancel, { once: true });
      this.failed = (error) => finish(error);
      const send = () =>
        this.child!.stdin.write(
          JSON.stringify({
            id,
            segments: doc.segments,
            voice: doc.settings.voice,
            pace: doc.settings.pace,
            profileHash,
            metadata: doc.audioMetadata,
          }) + "\n",
        );
      this.receiver = (raw) => {
        const m = z
          .object({
            ready: z.boolean().optional(),
            id: z.string().optional(),
            error: z.string().optional(),
            progress: z.number().optional(),
            total: z.number().optional(),
            done: z.boolean().optional(),
          })
          .passthrough()
          .parse(raw);
        if (m.ready) {
          send();
          return;
        }
        if (m.id !== id) return;
        if (m.error) finish(Error(m.error));
        else if (m.done) finish(undefined, generatedSchema.parse(m));
        else if (m.progress !== undefined)
          progress(m.progress, m.total ?? doc.segments.length);
      };
      if (this.child) {
        send();
        return;
      }
      const child = spawn(
        path.join(this.root, ".venv-narration/bin/python"),
        ["tools/narration/worker.py"],
        { cwd: this.root, stdio: ["pipe", "pipe", "pipe"] },
      );
      this.child = child;
      child.stdin.on("error", () => {});
      child.stderr.on("data", (chunk) => {
        stderr = (stderr + chunk).slice(-4000);
      });
      const lines = readline.createInterface({ input: child.stdout });
      lines.on("line", (line) => {
        try {
          this.receiver?.(JSON.parse(line));
        } catch {
          this.failed?.(Error("Invalid narration worker response"));
          this.close();
        }
      });
      child.on("error", (error) => {
        this.failed?.(
          Error(
            `Narration runtime unavailable: ${error.message}. Run npm run narration:setup.`,
          ),
        );
        if (this.child === child) this.child = undefined;
      });
      child.on("exit", () => {
        if (this.child !== child) return;
        this.child = undefined;
        this.failed?.(Error(`Narration worker stopped. ${stderr}`));
      });
    });
  }
}
