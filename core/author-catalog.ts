import { AuthorStore } from "./author-store";
import matter from "gray-matter";
import YAML from "yaml";
import { loadTagRegistry, readTagPieces, buildTagInventory } from "./tags";
export async function authorCatalog(root: string) {
  const store = new AuthorStore(root);
  return Promise.all(
    (await store.files()).map(async (file) => {
      const group = file.includes("/pieces/")
        ? "Articles"
        : file.includes("/collections/")
          ? "Books and collections"
          : "Settings";
      try {
        const { text } = await store.read(file);
        const data = file.endsWith(".md")
          ? matter(text, {
              engines: { yaml: (s) => YAML.parse(s, { maxAliasCount: 0 }) },
            }).data
          : YAML.parse(text, { maxAliasCount: 0 });
        return {
          file,
          id: typeof data.id === "string" ? data.id : undefined,
          group,
          title:
            data.title ||
            (
              {
                "content/tags.yaml": "Tags",
                "publishing/home.yaml": "Home page",
                "publishing/links.yaml": "Short links",
              } as Record<string, string>
            )[file] ||
            file,
          draft: data.draft === true || data.status === "draft",
        };
      } catch {
        return { file, group, title: file, draft: false };
      }
    }),
  );
}
export async function authorTags(root: string) {
  const store = new AuthorStore(root);
  const files = await Promise.all(
    (await store.files())
      .filter((file) => file.endsWith("/index.md"))
      .map((file) => store.file(file)),
  );
  return buildTagInventory(
    await readTagPieces([], files),
    await loadTagRegistry(await store.file("content/tags.yaml")),
  ).rows;
}
