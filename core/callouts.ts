import type { Root } from "mdast";
import type { Processor } from "unified";
import { visit } from "unist-util-visit";

/** A deliberately small Pandoc/Quarto fenced-div profile, parsed by remark. */
export function remarkCallouts(this: Processor) {
  const parse = this.parser!;
  this.parser = (source, file) => {
    if (!/^::: +\{/m.test(source)) return parse(source, file);
    const original = parse(source, file) as Root;
    const code: Array<[number, number]> = [];
    visit(original, "code", (node) => {
      code.push([node.position!.start.offset!, node.position!.end.offset!]);
    });
    const lines = source.split("\n");
    const starts: number[] = [];
    let offset = 0;
    let open = false;
    const normalized = lines.map((line) => {
      starts.push(offset);
      const protectedLine = code.some(([a, b]) => offset >= a && offset < b);
      offset += line.length + 1;
      if (protectedLine) return line;
      const match = /^::: +\{([^}]*)\}[ \t\r]*$/.exec(line);
      if (match) {
        if (open) throw Error("Nested callouts are not supported");
        open = true;
        return `:::callout{${match[1]}}`;
      }
      if (open && /^:::[ \t\r]*$/.test(line)) open = false;
      return line;
    });
    if (open) throw Error("Callout requires a closing ::: fence");
    const tree = parse(normalized.join("\n"), file) as Root;
    visit(tree, (node) => {
      // Book exports edit the original Markdown by offset, not normalized text.
      for (const point of [node.position?.start, node.position?.end]) {
        if (!point) continue;
        const index = point.line - 1;
        if (normalized[index] !== lines[index] && point.column > 1)
          point.column = lines[index].length + 1;
        point.offset = starts[index] + point.column - 1;
      }
      if (node.type !== "containerDirective" || node.name !== "callout") return;
      const attrs = node.attributes ?? {};
      if (
        attrs.class !== "callout-note" ||
        (attrs.appearance !== undefined && attrs.appearance !== "simple") ||
        (attrs.icon !== undefined && attrs.icon !== "false") ||
        Object.keys(attrs).some(
          (key) => !["class", "appearance", "icon"].includes(key),
        )
      )
        throw Error(
          'Supported callout: {.callout-note appearance="simple" icon="false"}; titles, other types and attributes are not yet supported',
        );
      node.data = {
        hName: "div",
        hProperties: { className: ["text-callout"] },
      };
    });
    return tree;
  };
}
