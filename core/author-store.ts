import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { stampPublication } from "./author-publication";
export const revision = (s: string) =>
  crypto.createHash("sha256").update(s).digest("hex");
export class AuthorStore {
  constructor(public root: string) {}
  async files() {
    const result: string[] = [];
    const walk = async (dir: string) => {
      for (const e of await fs.readdir(path.join(this.root, dir), {
        withFileTypes: true,
      })) {
        const p = `${dir}/${e.name}`;
        if (e.isDirectory()) await walk(p);
        else if (
          e.isFile() &&
          (/^content\/pieces\/[^/]+\/index\.md$/.test(p) ||
            /^content\/collections\/[^/]+\.yaml$/.test(p) ||
            p === "content/tags.yaml")
        )
          result.push(p);
      }
    };
    await walk("content");
    for (const p of ["publishing/home.yaml", "publishing/links.yaml"])
      if (await fs.stat(path.join(this.root, p)).catch(() => null))
        result.push(p);
    return result.sort(
      (a, b) =>
        Number(!a.endsWith("/index.md")) - Number(!b.endsWith("/index.md")) ||
        a.localeCompare(b),
    );
  }
  async file(p: string) {
    if (!(await this.files()).includes(p)) throw Error("File is not editable");
    const full = path.join(this.root, p);
    if ((await fs.realpath(full)) !== full)
      throw Error("Symbolic links are not editable");
    return full;
  }
  async read(p: string) {
    const text = await fs.readFile(await this.file(p), "utf8");
    return { text, revision: revision(text) };
  }
  historyDir(p: string) {
    return path.join(this.root, ".authoring-state/history", revision(p));
  }
  async history(p: string) {
    await this.file(p);
    const dir = this.historyDir(p);
    const names = await fs.readdir(dir).catch(() => []);
    return Promise.all(
      names
        .filter((n) => n.endsWith(".json"))
        .sort()
        .reverse()
        .map(async (n) =>
          JSON.parse(await fs.readFile(path.join(dir, n), "utf8")),
        ),
    );
  }
  async save(
    p: string,
    text: string,
    expected: string,
    validate: (text: string) => Promise<void>,
  ) {
    const full = await this.file(p),
      state = path.join(this.root, ".authoring-state");
    await fs.mkdir(state, { recursive: true });
    const lock = await fs
      .open(path.join(state, "write.lock"), "wx")
      .catch(() => {
        throw Error(
          "Another save is in progress; retry. If the editor crashed, remove .authoring-state/write.lock after stopping it.",
        );
      });
    const tmp = full + ".author-" + crypto.randomUUID();
    try {
      const old = await this.read(p);
      if (old.revision !== expected)
        throw Error(
          "Conflict: file changed outside this editor. Reload before saving; your edits are still recoverable.",
        );
      if (/^content\/pieces\/[^/]+\/index\.md$/.test(p))
        text = stampPublication(old.text, text);
      await validate(text);
      if (old.text === text) return old;
      const dir = this.historyDir(p);
      await fs.mkdir(dir, { recursive: true });
      const record = async (value: string, kind: string) =>
        fs.writeFile(
          path.join(dir, `${Date.now()}-${process.hrtime.bigint()}.json`),
          JSON.stringify({
            id: crypto.randomUUID(),
            date: new Date().toISOString(),
            kind,
            text: value,
            revision: revision(value),
          }),
          { flag: "wx" },
        );
      await record(old.text, "Before save");
      await fs.writeFile(tmp, text, {
        flag: "wx",
        mode: (await fs.stat(full)).mode,
      });
      if ((await this.read(p)).revision !== expected)
        throw Error("Conflict: file changed during validation.");
      await record(text, "Saved");
      await fs.rename(tmp, full);
      return { text, revision: revision(text) };
    } finally {
      await fs.rm(tmp, { force: true });
      await lock.close();
      await fs.rm(path.join(state, "write.lock"), { force: true });
    }
  }
}
