import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import matter from "gray-matter";
import YAML from "yaml";
import { z } from "zod";
import { AuthorStore, revision } from "./author-store";
import { loadLibrary, parser, pieceSchema, readYaml } from "./model";
import { siteConfig } from "./config";
import { assignmentSchema, exportPublication } from "./distribution";
import { writePublicationExport } from "./publication-export";
import { readAssetManifest } from "./asset-manifest";

const registrySchema = z
  .object({
    schemaVersion: z.literal(1),
    assignments: z.array(assignmentSchema),
  })
  .strict();
const requestSchema = z
  .object({
    file: z.string(),
    revision: z.string(),
    destination: z.string(),
    text: z.string(),
    tags: z.array(z.string()).optional(),
  })
  .strict();
export class AuthorExports {
  private store: AuthorStore;
  private downloads = new Map<string, { out: string; names: Set<string> }>();
  constructor(private root: string) {
    this.store = new AuthorStore(root);
  }
  private async context(file: string) {
    if (!/^content\/pieces\/[^/]+\/index\.md$/.test(file))
      throw Error(
        "Exports are available for standalone articles; select an article first.",
      );
    const source = await this.store.read(file);
    const metadata = pieceSchema.parse(
      matter(source.text, {
        engines: { yaml: (value) => YAML.parse(value, { maxAliasCount: 0 }) },
      }).data,
    );
    const registryFile = path.join(this.root, "publishing/distribution.yaml");
    const registryText = await fs.readFile(registryFile, "utf8");
    const registry = registrySchema.parse(
      YAML.parse(registryText, { maxAliasCount: 0 }),
    );
    const destinations = (
      await readYaml(path.join(this.root, "publishing/destinations.yaml"))
    ).destinations;
    return {
      source,
      metadata,
      registry,
      registryFile,
      registryText,
      destinations,
    };
  }
  async settings(file: string) {
    const c = await this.context(file);
    return {
      sourceRevision: c.source.revision,
      registryRevision: revision(c.registryText),
      destinations: Object.entries(c.destinations)
        .filter(([, value]) =>
          ["dev", "medium-assisted"].includes(
            (value as { plugin: string }).plugin,
          ),
        )
        .map(([id, value]) => ({
          id,
          label:
            (value as { plugin: string }).plugin === "dev"
              ? "DEV.to"
              : "Medium",
          assignment:
            c.registry.assignments.find(
              (a) => a.piece === c.metadata.id && a.destination === id,
            ) ?? null,
        })),
      tags: c.metadata.tags,
    };
  }
  async generate(input: unknown) {
    const request = requestSchema.parse(input),
      c = await this.context(request.file);
    if (request.revision !== c.source.revision)
      throw Error("File changed outside the editor. Reload before exporting.");
    const parsed = matter(request.text, {
        engines: { yaml: (value) => YAML.parse(value, { maxAliasCount: 0 }) },
      }),
      metadata = pieceSchema.parse(parsed.data);
    if (metadata.id !== c.metadata.id)
      throw Error("Save article identity changes before exporting.");
    const lib = await loadLibrary(path.join(this.root, "content"));
    const original = lib.pieces.get(metadata.id)!;
    const piece = {
      ...original,
      ...metadata,
      body: parsed.content,
      ast: parser().parse(parsed.content),
    };
    lib.pieces.set(piece.id, piece);
    const assignment = assignmentSchema.parse({
      ...(c.registry.assignments.find(
        (a) => a.piece === piece.id && a.destination === request.destination,
      ) ?? { piece: piece.id, destination: request.destination }),
      overrides: {
        ...(c.registry.assignments.find(
          (a) => a.piece === piece.id && a.destination === request.destination,
        )?.overrides ?? {}),
        ...(request.tags ? { tags: request.tags } : {}),
      },
    });
    const destination = c.destinations[request.destination];
    if (!destination) throw Error("Unknown export destination");
    const out = path.join(
      this.root,
      "exports",
      "editor",
      request.destination,
      piece.id,
    );
    for (const [id, download] of this.downloads)
      if (download.out === out) this.downloads.delete(id);
    await fs.rm(out, { recursive: true, force: true });
    try {
      const exported = await exportPublication(
        piece,
        lib,
        assignment,
        (await siteConfig()).url,
        {
          plugin: destination.plugin,
          assetsOut: path.join(out, "assets"),
          previewDraft: true,
        },
      );
      const result = await writePublicationExport(out, exported, this.root);
      if ((await this.store.read(request.file)).revision !== request.revision)
        throw Error("File changed during export. Reload and export again.");
      const manifest = await readAssetManifest(this.root);
      const id = crypto.randomUUID();
      this.downloads.set(id, {
        out,
        names: new Set([
          "bundle.zip",
          "article-online.md",
          "payload.json",
          ...result.assets.map((asset) => "assets/" + asset.name),
        ]),
      });
      return {
        id,
        ...result,
        canonical: exported.payload.canonical_url,
        review: exported.review,
        draft: piece.status === "draft",
        unsaved: request.text !== c.source.text,
        enrolled: c.registry.assignments.some(
          (a) => a.piece === piece.id && a.destination === request.destination,
        ),
        unprepared: result.assets
          .filter(
            (asset) =>
              manifest?.outputs[asset.name]?.sha256 !== asset.sha256 &&
              !Object.values(manifest?.sources ?? {}).some(
                (record) =>
                  record.publicKey &&
                  path.basename(record.publicKey) === asset.name &&
                  record.sha256 === asset.sha256,
              ),
          )
          .map((asset) => asset.name),
      };
    } catch (error) {
      await fs.rm(out, { recursive: true, force: true });
      throw error;
    }
  }
  async enroll(input: unknown) {
    const request = requestSchema
        .extend({ registryRevision: z.string() })
        .parse(input),
      c = await this.context(request.file);
    if (
      request.revision !== c.source.revision ||
      request.text !== c.source.text
    )
      throw Error("Save article edits before saving export settings.");
    if (request.registryRevision !== revision(c.registryText))
      throw Error("Export settings changed. Refresh this panel before saving.");
    if (!c.destinations[request.destination])
      throw Error("Unknown export destination");
    if (!c.metadata.publication.surfaces.includes("standalone"))
      throw Error("Only standalone articles can be enrolled.");
    const old = c.registry.assignments.find(
      (a) => a.piece === c.metadata.id && a.destination === request.destination,
    );
    const next = assignmentSchema.parse({
      ...(old ?? { piece: c.metadata.id, destination: request.destination }),
      overrides: {
        ...old?.overrides,
        ...(request.tags ? { tags: request.tags } : {}),
      },
    });
    if (
      c.destinations[request.destination].plugin === "dev" &&
      (next.overrides.tags ?? c.metadata.tags).length > 4
    )
      throw Error(
        "DEV supports four tags; adjust copy tags before saving settings.",
      );
    c.registry.assignments = [
      ...c.registry.assignments.filter((a) => a !== old),
      next,
    ];
    const temporary = c.registryFile + "." + crypto.randomUUID() + ".tmp";
    try {
      await fs.writeFile(temporary, YAML.stringify(c.registry));
      if (
        (await fs.readFile(c.registryFile, "utf8")) !== c.registryText ||
        (await this.store.read(request.file)).revision !== request.revision
      )
        throw Error(
          "Source or export settings changed during save. Refresh and retry.",
        );
      await fs.rename(temporary, c.registryFile);
    } finally {
      await fs.rm(temporary, { force: true });
    }
    return this.settings(request.file);
  }
  async download(id: string, name: string) {
    const item = this.downloads.get(id);
    if (!item?.names.has(name))
      throw Error(
        "Export expired or file unavailable. Generate the export again.",
      );
    return {
      bytes: await fs.readFile(path.join(item.out, name)),
      name: path.basename(name),
    };
  }
}
