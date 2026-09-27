import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import YAML from "yaml";
import { visit } from "unist-util-visit";
import { AuthorStore, revision } from "./author-store";
import {
  loadLibrary,
  pieceSchema,
  collectionSchema,
  validateCollection,
  type Node,
} from "./model";
import { homeSchema } from "./config";
import { linksSchema } from "./shortlinks";

const yaml = (text: string) => {
  const doc = YAML.parseDocument(text);
  if (doc.errors.length) throw doc.errors[0];
  doc.toJS({ maxAliasCount: 0 });
  return doc;
};
function asDraft(text: string) {
  const match = /^(---\r?\n)([\s\S]*?)(\r?\n---)([\s\S]*)$/.exec(text);
  if (!match) throw Error("Missing metadata header");
  const doc = yaml(match[2]);
  doc.delete("status");
  doc.set("draft", true);
  pieceSchema.parse(doc.toJS({ maxAliasCount: 0 }));
  return match[1] + doc.toString().trimEnd() + match[3] + match[4];
}

type Change = { file: string; before: string; after: string };
export class AuthorLifecycle {
  store: AuthorStore;
  constructor(public root: string) {
    this.store = new AuthorStore(root);
  }
  async unpublish(file: string, expected: string) {
    const old = await this.store.read(file);
    if (!/^content\/pieces\/[^/]+\/index\.md$/.test(file))
      throw Error("Choose an article");
    return this.store.save(file, asDraft(old.text), expected, async () => {});
  }
  async plan(file: string, expected: string) {
    if (!/^content\/pieces\/[^/]+\/index\.md$/.test(file))
      throw Error("Choose an article");
    const old = await this.store.read(file);
    if (old.revision !== expected)
      throw Error("Conflict: article changed. Reload before deleting.");
    const lib = await loadLibrary(path.join(this.root, "content"));
    const candidate = [...lib.pieces.values()].find(
      (p) => path.join(p.dir, "index.md") === path.join(this.root, file),
    );
    if (!candidate || candidate.status !== "draft")
      throw Error("Unpublish this article to draft before deleting it.");
    const piece = candidate;
    const changes: Change[] = [];
    const aliases: string[] = [];
    const placements: string[] = [];
    const blockers: string[] = [];
    const inputs: Record<string, string> = {};
    // Include all dependency sources in the confirmation fingerprint, not just changed files.
    for (const name of await this.store.files())
      inputs[name] = (await this.store.read(name)).text;
    const read = async (name: string) => {
      const full = path.join(this.root, name);
      const text = await fs
        .readFile(full, "utf8")
        .catch((e: NodeJS.ErrnoException) => {
          if (e.code === "ENOENT") return undefined;
          throw e;
        });
      if (text === undefined) return;
      if ((await fs.realpath(full)) !== full)
        throw Error("Symbolic links are not editable");
      inputs[name] = text;
      return yaml(text);
    };
    // Other authored prose and block descriptors may contain links to this article.
    const scanSources = async (dir: string) => {
      for (const entry of await fs.readdir(path.join(this.root, dir), {
        withFileTypes: true,
      })) {
        const name = `${dir}/${entry.name}`;
        if (name === path.posix.dirname(file)) continue;
        if (entry.isDirectory()) await scanSources(name);
        else if (
          entry.isFile() &&
          /\.(md|yaml|json|bib)$/.test(name) &&
          !(name in inputs)
        ) {
          const full = path.join(this.root, name);
          if ((await fs.realpath(full)) !== full)
            throw Error("Symbolic links are not editable");
          inputs[name] = await fs.readFile(full, "utf8");
        }
      }
    };
    await scanSources("content");
    await read("publishing/distribution.yaml");
    const record = (name: string, doc: ReturnType<typeof yaml>) => {
      const after = doc.toString();
      if (after !== inputs[name])
        changes.push({ file: name, before: inputs[name], after });
    };
    const linksFile = await removeAliases();
    const destinations = new Set<string>();
    if (piece.slug) destinations.add(`/writing/${piece.slug}/`);
    removePlacements();
    checkReferences();
    await removeHomepageReferences();
    const assignments = await removeDistributionAssignments();
    const assets: Record<string, string> = {};
    const walk = async (dir: string) => {
      for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isSymbolicLink())
          throw Error(
            "Remove symbolic links from the article folder before deleting",
          );
        if (entry.isDirectory()) await walk(full);
        else if (entry.isFile())
          assets[path.relative(this.root, full)] = crypto
            .createHash("sha256")
            .update(await fs.readFile(full))
            .digest("hex");
        else throw Error("Unsupported article file");
      }
    };
    await walk(piece.dir);
    return {
      file,
      id: piece.id,
      title: piece.title,
      aliases,
      placements,
      assignments,
      files: Object.keys(assets),
      changes,
      revision: revision(JSON.stringify({ inputs, assets })),
    };

    async function removeDistributionAssignments() {
      const distributionFile = "publishing/distribution.yaml",
        distribution = await read(distributionFile);
      let assignments = 0;
      if (distribution) {
        const items = distribution.get("assignments", true);
        if (YAML.isSeq(items))
          for (let i = items.items.length - 1; i >= 0; i--) {
            const item = items.items[i];
            if (YAML.isMap(item) && item.get("piece") === piece.id) {
              items.delete(i);
              assignments++;
            }
          }
        if (assignments) record(distributionFile, distribution);
      }
      return assignments;
    }

    async function removeHomepageReferences() {
      const homeFile = "publishing/home.yaml",
        home = await read(homeFile);
      if (home) {
        let changed = false;
        if (home.get("lead") === piece.id) {
          home.delete("lead");
          changed = true;
        }
        const items = home.get("newIn", true);
        if (YAML.isSeq(items))
          for (let i = items.items.length - 1; i >= 0; i--) {
            const item = items.items[i];
            if (YAML.isMap(item) && item.get("piece") === piece.id) {
              items.delete(i);
              changed = true;
            }
          }
        homeSchema.parse(home.toJS({ maxAliasCount: 0 }));
        if (changed) record(homeFile, home);
      }
    }

    function checkReferences() {
      for (const p of lib.pieces.values()) {
        if (p.id === piece.id) continue;
        if (p.adaptedFrom === piece.id)
          blockers.push(`${p.title}: adaptation source`);
        visit(p.ast, (node) => {
          if (
            node.type === "textDirective" &&
            node.name === "ref" &&
            String(node.attributes?.target ?? "").split("#")[0] === piece.id
          )
            blockers.push(`${p.title}: article reference`);
        });
      }
      // Catch prose/config URLs as well as semantic references; never rewrite authored prose silently.
      const urls = [
        ...destinations,
        ...aliases.map((a) => `danilop.link/${a}`),
      ].map(
        (url) =>
          new RegExp(
            url.replace(/\/$/, "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&") +
              "(?=[/#?\\s)\\]\"'<>]|$)",
          ),
      );
      for (const [name, text] of Object.entries(inputs)) {
        if (
          name === file ||
          name === linksFile ||
          name === "publishing/home.yaml"
        )
          continue;
        if (urls.some((url) => url.test(text)))
          blockers.push(`${name}: link to this article`);
      }
      if (blockers.length)
        throw Error(
          "Resolve these references before deleting:\n" +
            [...new Set(blockers)].join("\n"),
        );
    }

    function removePlacements() {
      for (const name of Object.keys(inputs).filter((n) =>
        n.startsWith("content/collections/"),
      )) {
        const doc = yaml(inputs[name]);
        const collection = collectionSchema.parse(
          doc.toJS({ maxAliasCount: 0 }),
        );
        let count = 0;
        const remove = (nodes: Node[]): Node[] =>
          nodes.flatMap((n) => {
            if (n.ref === piece.id) {
              // Nested content belongs to the collection, not to the deleted article.
              if (
                [...(n.before ?? []), ...(n.children ?? []), ...(n.after ?? [])]
                  .length
              )
                blockers.push(
                  `${collection.title}: move the nested content out of placement ${n.id} first`,
                );
              count++;
              placements.push(`${collection.title} / ${n.id}`);
              destinations.add(`/collections/${collection.slug}/read/${n.id}/`);
              return [];
            }
            for (const key of ["before", "children", "after"] as const)
              if (n[key]) n[key] = remove(n[key]);
            return [n];
          });
        // Edit sequence nodes in place to preserve comments on unaffected entries.
        const prune = (seq: unknown) => {
          if (!YAML.isSeq(seq)) return;
          for (let i = seq.items.length - 1; i >= 0; i--) {
            const n = seq.items[i];
            if (!YAML.isMap(n)) continue;
            if (n.get("ref") === piece.id) seq.delete(i);
            else
              for (const key of ["before", "children", "after"])
                prune(n.get(key, true));
          }
        };
        for (const key of ["frontMatter", "body", "backMatter"] as const) {
          collection[key] = remove(collection[key]);
          prune(doc.get(key, true));
        }
        if (count) {
          const remaining = new Map(lib.pieces);
          remaining.delete(piece.id);
          validateCollection(collection, remaining);
          record(name, doc);
        }
      }
    }

    async function removeAliases() {
      const linksFile = "publishing/links.yaml";
      const linksDoc = await read(linksFile);
      if (linksDoc) {
        const config = linksSchema.parse(linksDoc.toJS({ maxAliasCount: 0 }));
        for (const [alias, target] of Object.entries(config.links)) {
          if (target.ref !== piece.id) continue;
          aliases.push(alias);
          linksDoc.deleteIn(["links", alias]);
          // A tombstone is needed even if unpublish and deletion ship in one deployment.
          linksDoc.setIn(["removed", alias], piece.id);
        }
        if (aliases.length) record(linksFile, linksDoc);
      }
      if (piece.shortCode && !aliases.includes(piece.shortCode))
        throw Error(
          "The article's short code is not registered. Repair Short links before deleting.",
        );
      return linksFile;
    }
  }
  async delete(file: string, expected: string, confirmedPlan: string) {
    const state = path.join(this.root, ".authoring-state");
    await fs.mkdir(state, { recursive: true });
    const lockPath = path.join(state, "write.lock");
    const lock = await fs.open(lockPath, "wx").catch(() => {
      throw Error("Another save is in progress; retry.");
    });
    let keepLock = false;
    try {
      const plan = await this.plan(file, expected);
      if (plan.revision !== confirmedPlan)
        throw Error(
          "Conflict: dependencies changed. Review the deletion again.",
        );
      const backup = path.join(state, "trash", crypto.randomUUID());
      await fs.mkdir(backup, { recursive: true });
      await fs.writeFile(
        path.join(backup, "manifest.json"),
        JSON.stringify(
          { ...plan, deletedAt: new Date().toISOString() },
          null,
          2,
        ),
      );
      const folder = path.dirname(path.join(this.root, file));
      let moved = false;
      const applied: Change[] = [];
      const replace = async (name: string, text: string) => {
        const full = path.join(this.root, name),
          tmp = full + ".author-" + crypto.randomUUID();
        try {
          await fs.writeFile(tmp, text, {
            flag: "wx",
            mode: (await fs.stat(full)).mode,
          });
          await fs.rename(tmp, full);
        } finally {
          await fs.rm(tmp, { force: true });
        }
      };
      try {
        if ((await this.plan(file, expected)).revision !== confirmedPlan)
          throw Error("Conflict: dependencies changed during deletion.");
        await applyChanges(this.root, plan, replace, applied);
        await fs.rename(folder, path.join(backup, "piece"));
        moved = true;
        await fs.writeFile(path.join(backup, "complete"), "Deleted locally\n");
      } catch (error) {
        try {
          if (moved) await fs.rename(path.join(backup, "piece"), folder);
          for (const change of applied.reverse()) {
            if (
              (await fs.readFile(path.join(this.root, change.file), "utf8")) !==
              change.after
            )
              throw Error(
                "Dependency changed outside the editor during rollback",
                { cause: error },
              );
            await replace(change.file, change.before);
          }
        } catch (error) {
          keepLock = true;
          throw Error(
            `Deletion interrupted. Stop the editor and recover from ${path.relative(this.root, backup)} before removing write.lock.`,
            { cause: error },
          );
        }
        throw error;
      }
      return {
        ok: true,
        recovery: path.relative(this.root, backup),
        aliases: plan.aliases,
      };
    } finally {
      await lock.close();
      if (!keepLock) await fs.rm(lockPath, { force: true });
    }

    async function applyChanges(
      root: string,
      plan: {
        file: string;
        id: string;
        title: string;
        aliases: string[];
        placements: string[];
        assignments: number;
        files: string[];
        changes: Change[];
        revision: string;
      },
      replace: (name: string, text: string) => Promise<void>,
      applied: Change[],
    ) {
      for (const change of plan.changes) {
        if (
          (await fs.readFile(path.join(root, change.file), "utf8")) !==
          change.before
        )
          throw Error("Conflict: dependency changed during deletion.");
        await replace(change.file, change.after);
        applied.push(change);
      }
    }
  }
}
