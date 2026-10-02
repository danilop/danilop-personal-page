import path from "node:path";
import { execFileSync } from "node:child_process";
import YAML from "yaml";
import matter from "gray-matter";
import { loadLibrary } from "./model";
import { siteConfig } from "./config";
import { loadEditions } from "./editions";
import { AuthorStore } from "./author-store";
import { compileLinks, linksSchema } from "./shortlinks";
import { shortLinkConfig, ShortLinkStorage } from "./shortlink-storage";

export class AuthorLinks {
  private store: AuthorStore;
  constructor(private root: string) {
    this.store = new AuthorStore(root);
  }
  async context(file: string) {
    const source = await this.store.read(file);
    let ref: string;
    if (file.endsWith("/index.md"))
      ref = String(matter(source.text).data.id ?? "");
    else if (/^content\/collections\/[^/]+\.yaml$/.test(file))
      ref = String(YAML.parse(source.text, { maxAliasCount: 0 }).id ?? "");
    else throw Error("Short links belong to articles or collections");
    const registry = await this.store.read("publishing/links.yaml");
    const manifest = linksSchema.parse(
      YAML.parse(registry.text, { maxAliasCount: 0 }),
    );
    const lib = await loadLibrary(path.join(this.root, "content"));
    const config = await siteConfig();
    const targets = compileLinks(
      manifest,
      lib,
      config.url,
      await loadEditions(),
    );
    return { ref, source, registry, manifest, targets };
  }
  async list(file: string) {
    const context = await this.context(file);
    const links = Object.entries(context.manifest.links)
      .filter(([, target]) => target.ref === context.ref)
      .map(([code, target]) => ({
        code,
        edition: target.edition ?? null,
        target: context.targets[code] ?? null,
      }));
    let configured = false,
      shortOrigin = "",
      configurationError = "";
    try {
      const config = await shortLinkConfig(this.root);
      configured = true;
      shortOrigin = config.shortOrigin;
    } catch (error) {
      configurationError =
        error instanceof Error ? error.message : String(error);
    }
    return {
      links,
      configured,
      shortOrigin,
      configurationError,
      registryRevision: context.registry.revision,
      sourceRevision: context.source.revision,
    };
  }
  async reserve(data: {
    file: string;
    code: string;
    revision: string;
    registryRevision: string;
  }) {
    const context = await this.context(data.file);
    if (
      data.revision !== context.source.revision ||
      data.registryRevision !== context.registry.revision
    )
      throw Error(
        "File or link registry changed; refresh before reserving a code",
      );
    if (
      context.manifest.links[data.code] ||
      context.manifest.removed[data.code]
    )
      throw Error("This code is already reserved");
    const next = linksSchema.parse({
      ...context.manifest,
      links: { ...context.manifest.links, [data.code]: { ref: context.ref } },
    });
    compileLinks(
      next,
      await loadLibrary(path.join(this.root, "content")),
      (await siteConfig()).url,
      await loadEditions(),
    );
    const config = await shortLinkConfig(this.root).catch(() => null);
    if (config) {
      const storage = new ShortLinkStorage(config);
      const remote = await storage.inspect();
      const ownership = await storage.ownership();
      if (
        remote[data.code] ||
        remote[data.code + "/"] ||
        ownership.owners[data.code]
      )
        throw Error(
          "This code already exists remotely; select a different code",
        );
    }
    await this.store.save(
      "publishing/links.yaml",
      YAML.stringify(next),
      context.registry.revision,
      async () => {},
    );
    return this.list(data.file);
  }
  async deactivate(data: {
    file: string;
    code: string;
    revision: string;
    registryRevision: string;
  }) {
    const context = await this.context(data.file);
    if (
      data.revision !== context.source.revision ||
      data.registryRevision !== context.registry.revision
    )
      throw Error(
        "File or link registry changed; refresh before disabling a code",
      );
    const target = context.manifest.links[data.code];
    if (!target || target.ref !== context.ref)
      throw Error("Code does not belong to this content");
    const object = context.manifest.links;
    delete object[data.code];
    context.manifest.removed[data.code] = [target.ref, target.edition]
      .filter(Boolean)
      .join("@");
    // A primary code is part of content identity; use Unpublish instead of removing it.
    compileLinks(
      context.manifest,
      await loadLibrary(path.join(this.root, "content")),
      (await siteConfig()).url,
      await loadEditions(),
    );
    await this.store.save(
      "publishing/links.yaml",
      YAML.stringify(context.manifest),
      context.registry.revision,
      async () => {},
    );
    return this.list(data.file);
  }
  async publish(data: {
    file: string;
    revision: string;
    registryRevision: string;
  }) {
    const context = await this.context(data.file);
    if (
      data.revision !== context.source.revision ||
      data.registryRevision !== context.registry.revision
    )
      throw Error(
        "File or link registry changed; refresh before publishing redirects",
      );
    const config = await shortLinkConfig(this.root);
    const revision = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: this.root,
      encoding: "utf8",
    }).trim();
    const dirty = execFileSync(
      "git",
      [
        "status",
        "--porcelain",
        "--untracked-files=all",
        "--",
        "content",
        "publishing",
      ],
      { cwd: this.root, encoding: "utf8" },
    ).trim();
    if (dirty)
      throw Error(
        "Commit and deploy saved content and link reservations first, then publish redirects",
      );
    const verify = async () => {
      const marker = await fetch(
        config.canonicalOrigin + "/build.json?revision=" + revision,
        { cache: "no-store", signal: AbortSignal.timeout(15000) },
      );
      if (!marker.ok || (await marker.json()).revision !== revision)
        throw Error("Deploy this commit before publishing redirects");
      if (
        (await this.store.read("publishing/links.yaml")).revision !==
        context.registry.revision
      )
        throw Error("Link registry changed during publication");
    };
    await verify();
    for (const target of Object.values(context.targets)) {
      const response = await fetch(target, {
        method: "HEAD",
        redirect: "manual",
        signal: AbortSignal.timeout(15000),
      });
      if (response.status !== 200)
        throw Error("Canonical destination is not deployed: " + target);
    }
    return new ShortLinkStorage(config).publish(
      context.manifest,
      context.targets,
      revision,
      verify,
    );
  }
  async check(file: string) {
    const { links, shortOrigin } = await this.list(file);
    if (!shortOrigin)
      throw Error("Short-link infrastructure is not configured");
    const results = [];
    for (const link of links) {
      const url = shortOrigin + "/" + link.code;
      const get = await fetch(url, {
        redirect: "manual",
        signal: AbortSignal.timeout(15000),
      });
      await get.body?.cancel();
      const head = await fetch(url, {
        method: "HEAD",
        redirect: "manual",
        signal: AbortSignal.timeout(15000),
      });
      results.push({
        code: link.code,
        url,
        status: get.status,
        location: get.headers.get("location"),
        ready:
          !!link.target &&
          get.status === 302 &&
          head.status === 302 &&
          get.headers.get("location") === link.target &&
          head.headers.get("location") === link.target,
      });
    }
    return { results };
  }
}
