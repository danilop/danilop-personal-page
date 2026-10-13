import { Narrations, checkAllNarrations } from "../core/narration";
import { narrationLock } from "../core/narration-store";
import { narrationUnits, speechDocument } from "../core/narration-speech";
import { loadLibrary, type Library } from "../core/model";
import { AuthorStore } from "../core/author-store";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
function selection(lib: Library, id?: string) {
  const units = [...narrationUnits(lib).values()];
  if (!id) return units;
  const matches = units.filter((u) => u.piece.id === id);
  if (matches.length) return matches;
  const piece = lib.pieces.get(id);
  if (!piece) throw Error("Unknown article");
  return [{ piece, title: piece.title }];
}
async function sample(manager: Narrations, root: string, pieceDir: string) {
  const file = path.relative(root, path.join(pieceDir, "index.md"));
  const saved = await new AuthorStore(root).read(file);
  let job = await manager.start({ file, ...saved }, true);
  while (["queued", "preparing"].includes(job.status)) {
    await delay(250);
    job = manager.get(job.id);
  }
  if (!job.result) throw Error(job.error ?? "Audition cancelled");
  console.log(
    path.join(
      root,
      ".authoring-state/narration/jobs",
      job.result.id,
      "audio.mp3",
    ),
  );
}
async function main() {
  const [action, ...args] = process.argv.slice(2),
    root = process.cwd();
  if (action === "recover") {
    await narrationLock(root, async () => {});
    return;
  }
  if (action === "check") {
    console.log(
      `${await checkAllNarrations(root, args.includes("--hydrate"))} public narration renditions verified.`,
    );
    return;
  }
  const manager = new Narrations(root);
  try {
    const lib = await loadLibrary();
    const units = selection(lib, args[0]);
    for (const { piece, title } of units) {
      if (!piece) throw Error("Unknown article");
      if (action === "inventory") {
        const doc = await speechDocument(root, piece, lib, undefined, title);
        console.log(
          JSON.stringify(
            {
              id: piece.id,
              title,
              segments: doc.segments.length,
              issues: doc.issues,
            },
            null,
            2,
          ),
        );
      } else if (action === "sample") {
        await sample(manager, root, piece.dir);
      } else if (action === "prepare") {
        const r = await manager.prepareSaved(piece.id, title);
        console.log(
          `${piece.id}: ${r.audio.duration.toFixed(1)} seconds, ${r.audio.bytes} bytes, ready`,
        );
      } else
        throw Error(
          "Usage: narration <inventory|sample|prepare|check|recover> [piece-id|--hydrate]",
        );
    }
  } finally {
    manager.close();
  }
}
main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
