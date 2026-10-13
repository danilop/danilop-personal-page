import { readingPlan } from "./reading-structure";
import { visit } from "unist-util-visit";
import type { AssemblyNode } from "./model";

export type TextEdit = { start: number; end: number; value: string };
type SourceNote = {
  anchor: string;
  number: number;
  text: string;
  source: AssemblyNode;
};
export const bookHeadingSlug = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "section";

export function bookLayout(nodes: AssemblyNode[]) {
  const layout = new Map<
    string,
    {
      depth: number;
      omit: boolean;
      anchor: string;
      attachAnchor: boolean;
      group: AssemblyNode;
      sample: boolean;
    }
  >();
  const plan = readingPlan(nodes, { target: "book" });
  const firstChapterIndex = nodes.findIndex((n) => n.kind === "chapter");
  const firstChapter = nodes[firstChapterIndex];
  const sampleEnd = firstChapter
    ? nodes.findIndex(
        (n, index) =>
          index > firstChapterIndex && n.depth <= firstChapter.depth,
      )
    : nodes.findIndex((n) => n.piece) + 1;
  for (const [index, n] of nodes.entries()) {
    const format = plan.get(n.id)!;
    const { group, omit } = format;
    const depth = format.bodyOffset + 1;
    const first = n.piece?.ast.children[0];
    const startsWithHeading = first?.type === "heading";
    const headingText = startsWithHeading
      ? first.children.map((c) => ("value" in c ? c.value : "")).join("")
      : "";
    layout.set(n.id, {
      depth,
      omit,
      group,
      anchor:
        omit && startsWithHeading
          ? `${n.id}-${bookHeadingSlug(headingText)}`
          : n.id,
      attachAnchor: omit && !startsWithHeading,
      sample: sampleEnd < 0 || index < sampleEnd,
    });
  }
  return layout;
}

// Markua permits only one use of a footnote ID. Chapter-grouped source notes
// instead support repeated citations (including citations across split pieces).
export function bookSourceNotes(
  nodes: AssemblyNode[],
  layout: ReturnType<typeof bookLayout>,
) {
  const edits = new Map<string, TextEdit[]>();
  const groups = new Map<
    string,
    {
      last: string;
      depth: number;
      notes: Map<string, SourceNote>;
    }
  >();
  for (const n of nodes) {
    const format = layout.get(n.id)!;
    const groupId = format.group.id;
    let group = groups.get(groupId);
    if (!group) {
      group = {
        last: n.id,
        depth: layout.get(groupId)!.depth + 1,
        notes: new Map(),
      };
      groups.set(groupId, group);
    }
    group.last = n.id;
    if (!n.piece) continue;
    const piece = n.piece;
    const replacements: TextEdit[] = [];
    const definitions = new Map<string, string>();
    for (const node of piece.ast.children) {
      if (node.type !== "footnoteDefinition") continue;
      const text = node.children
        .map((child) =>
          piece.body
            .slice(child.position!.start.offset, child.position!.end.offset)
            .replace(/^ {4}/gm, ""),
        )
        .join("\n\n");
      definitions.set(node.identifier, text);
      replacements.push({
        start: node.position!.start.offset!,
        end: node.position!.end.offset!,
        value: "",
      });
    }
    visit(piece.ast, (node) => {
      if (node.type === "footnoteDefinition") return "skip";
      if (node.type !== "footnoteReference") return;
      const text = definitions.get(node.identifier);
      if (!text)
        throw Error(`Missing book source note: ${n.id}/${node.identifier}`);
      // The same label with different evidence must never silently collapse.
      const key = JSON.stringify([
        node.identifier,
        text,
        /\]\((?!https?:)/.test(text) ? piece.id : "",
      ]);
      let note = group.notes.get(key);
      if (!note) {
        const number = group.notes.size + 1;
        note = {
          anchor: `${groupId}-source-note-${number}`,
          number,
          text,
          source: n,
        };
        group.notes.set(key, note);
      }
      replacements.push({
        start: node.position!.start.offset!,
        end: node.position!.end.offset!,
        value: `[${note.number}](#${note.anchor})`,
      });
    });
    edits.set(n.id, replacements);
  }
  return { edits, ...renderSourceNotes(groups) };
}

function renderSourceNotes(
  groups: Map<
    string,
    { last: string; depth: number; notes: Map<string, SourceNote> }
  >,
) {
  const after = new Map<string, string>();
  const anchors = new Set<string>();
  const entries = new Map<string, SourceNote[]>();
  for (const [id, group] of groups) {
    if (!group.notes.size) continue;
    if (group.depth > 6) throw Error(`Book source notes too deep: ${id}`);
    for (const note of group.notes.values()) anchors.add(note.anchor);
    entries.set(group.last, [...group.notes.values()]);
    after.set(
      group.last,
      `{#${id}-source-notes}\n${"#".repeat(group.depth)} Source notes\n\n` +
        [...group.notes.values()]
          .map((n) => `{#${n.anchor}}\n**${n.number}.** ${n.text}`)
          .join("\n\n") +
        "\n",
    );
  }
  return { after, anchors, entries };
}
