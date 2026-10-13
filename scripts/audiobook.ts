import { Audiobooks, checkAllAudiobooks } from "../core/audiobooks";
import { loadLibrary } from "../core/model";
import { publicBooks } from "../core/audiobook-plan";
async function main() {
  const [action, ...args] = process.argv.slice(2),
    root = process.cwd();
  if (action === "check") {
    console.log(
      `${await checkAllAudiobooks(root, args.includes("--hydrate"))} public audiobooks verified.`,
    );
    return;
  }
  const manager = new Audiobooks(root);
  try {
    const ids = args.filter((a) => !a.startsWith("--"));
    if (!ids.length)
      ids.push(...publicBooks(await loadLibrary()).map((c) => c.id));
    for (const id of ids) {
      if (action === "inventory")
        console.log(
          JSON.stringify(
            await manager.plan(id, args.includes("--preview")),
            null,
            2,
          ),
        );
      else if (action === "prepare") {
        const r = await manager.prepare(id, args.includes("--preview"));
        console.log(
          `${id}: ${r.audio.duration.toFixed(1)} seconds; ${r.audio.bytes} bytes; ${r.audio.reusedChunks} reused chunks`,
        );
      } else
        throw Error(
          "Usage: audiobook <prepare|inventory|check> [book-id] [--preview|--hydrate]",
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
