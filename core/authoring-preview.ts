import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import matter from "gray-matter";
import YAML from "yaml";
import {
  prepareImport,
  applyImport,
  type ImportOptions,
} from "./content-import";
import { Library, loadLibrary } from "./model";
export type AuthoringContext = {
  workspace: string;
  pieces: string[];
  collections: string[];
  date: string;
};
export async function authoringContext(
  root = process.cwd(),
  env = process.env,
): Promise<AuthoringContext | undefined> {
  const file = path.join(root, ".authoring-preview.json");
  const raw = await fs
    .readFile(file, "utf8")
    .catch((e: NodeJS.ErrnoException) => {
      if (e.code === "ENOENT") return undefined;
      throw e;
    });
  if (!raw && !env.NOTES_AUTHORING_PREVIEW) return undefined;
  if (!raw || env.NOTES_AUTHORING_PREVIEW !== "1" || env.CI || env.AWS_BRANCH)
    throw Error(
      "Authoring artifacts can only be built explicitly in a local isolated workspace",
    );
  const context = JSON.parse(raw) as AuthoringContext;
  if (
    context.workspace !== path.resolve(root) ||
    !Array.isArray(context.pieces) ||
    !Array.isArray(context.collections)
  )
    throw Error("Invalid authoring workspace");
  return context;
}
export async function stageAuthoring(
  repository: string,
  options: Omit<ImportOptions, "to">,
  select: boolean,
) {
  const workspace = await fs.mkdtemp(
    path.join(await fs.realpath(os.tmpdir()), "homepage-authoring-"),
  );
  try {
    // Only versionable source files, never ignored drafts, reports or credentials.
    await copyWorkspace();
    const context: AuthoringContext = {
      workspace,
      pieces: [],
      collections: [],
      date: new Date().toISOString().slice(0, 10),
    };
    if (select) {
      const imported = await prepareImport({
        ...options,
        from: path.resolve(repository, options.from),
        to: path.join(workspace, "content"),
        update: true,
      });
      await applyImport(imported);
      const library = await loadLibrary(path.join(workspace, "content"));
      for (const selected of imported.plan.selected) {
        const [kind, id] = selected.split(":");
        if (kind === "piece") {
          await overlayPiece(library, id, context);
        } else {
          await overlayCollection(library, id, context);
        }
      }
    }
    const configFile = path.join(workspace, "publishing/deployment.json");
    const config = JSON.parse(await fs.readFile(configFile, "utf8"));
    await fs.writeFile(
      configFile,
      JSON.stringify({
        ...config,
        basePath: "/",
        preserveOriginal: false,
        indexable: false,
      }),
    );
    await fs.writeFile(
      path.join(workspace, ".authoring-preview.json"),
      JSON.stringify(context),
    );
    return { workspace, context };
  } catch (error) {
    await fs.rm(workspace, { recursive: true, force: true });
    throw error;
  }

  async function overlayCollection(
    library: Library,
    id: string,
    context: AuthoringContext,
  ) {
    const collection = library.collections.find((c) => c.id === id)!;
    if (collection.status === "draft") {
      context.collections.push(id);
      // Existing collection filenames need not match their metadata IDs.
      for (const name of await fs.readdir(
        path.join(workspace, "content/collections"),
      )) {
        if (!name.endsWith(".yaml")) continue;
        const file = path.join(workspace, "content/collections", name);
        const doc = YAML.parseDocument(await fs.readFile(file, "utf8"));
        if (doc.get("id") === id) {
          doc.delete("draft");
          doc.set("status", "published");
          await fs.writeFile(file, doc.toString());
        }
      }
    }
  }

  async function overlayPiece(
    library: Library,
    id: string,
    context: AuthoringContext,
  ) {
    const piece = library.pieces.get(id)!;
    if (piece.status === "draft") {
      context.pieces.push(id);
      const file = path.join(piece.dir, "index.md");
      const raw = await fs.readFile(file, "utf8");
      const parsed = matter(raw, {
        engines: { yaml: (s) => YAML.parse(s, { maxAliasCount: 0 }) },
      });
      delete parsed.data.draft;
      parsed.data.status = "published";
      if (piece.publication.surfaces.includes("standalone")) {
        if (!piece.slug)
          throw Error(
            `Select the intended standalone slug before previewing ${id}`,
          );
        parsed.data.publishedAt ??= context.date;
      }
      await fs.writeFile(
        file,
        "---\n" + YAML.stringify(parsed.data) + "---\n" + parsed.content,
      );
    }
  }

  async function copyWorkspace() {
    const files = execFileSync(
      "git",
      ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
      { cwd: repository, encoding: "utf8" },
    )
      .split("\0")
      .filter(Boolean);
    for (const file of new Set(files)) {
      if (
        file.startsWith("exports/") ||
        file.startsWith(".git/") ||
        file === ".authoring-preview.json"
      )
        continue;
      const source = path.join(repository, file);
      const stat = await fs.lstat(source).catch((e: NodeJS.ErrnoException) => {
        if (e.code === "ENOENT") return null;
        throw e;
      });
      if (!stat) continue;
      if (!stat.isFile())
        throw Error(`Preview source must be a regular file: ${file}`);
      await fs.mkdir(path.dirname(path.join(workspace, file)), {
        recursive: true,
      });
      await fs.copyFile(source, path.join(workspace, file));
    }
    await fs.symlink(
      path.join(repository, "node_modules"),
      path.join(workspace, "node_modules"),
      "dir",
    );
    await fs
      .cp(path.join(repository, "cache"), path.join(workspace, "cache"), {
        recursive: true,
      })
      .catch((e: NodeJS.ErrnoException) => {
        if (e.code !== "ENOENT") throw e;
      });
  }
}
