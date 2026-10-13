/** Presentation is derived from placement relationships, never title equality. */
export type ReadingNode = {
  id: string;
  kind: string;
  depth: number;
  number?: string;
  integration?: "body" | "section";
  bookHeading?: "include" | "omit";
};

export function readingPlan<T extends ReadingNode>(
  nodes: T[],
  options: { target?: "web" | "book"; rootId?: string } = {},
) {
  const target = options.target ?? "web";
  const root = options.rootId && nodes.find((n) => n.id === options.rootId);
  if (options.rootId && !root)
    throw Error(`Unknown reading root ${options.rootId}`);
  const plan = new Map<
    string,
    {
      headingLevel: number | null;
      bodyOffset: number;
      parent?: T;
      group: T;
      omit: boolean;
      inContents: boolean;
      readingPart?: { position: number; total: number };
    }
  >();
  const ancestors: T[] = [];
  const bodyGroups = new Map<string, T[]>();
  for (const n of nodes) {
    while (ancestors.length && ancestors.at(-1)!.depth >= n.depth)
      ancestors.pop();
    const parent = ancestors.at(-1);
    const body = n.integration === "body";
    const legacyOmit = target === "book" && n.bookHeading === "omit";
    validateIntegration(n, parent, body, legacyOmit);
    if (body) {
      const siblings = bodyGroups.get(parent!.id) ?? [];
      siblings.push(n);
      bodyGroups.set(parent!.id, siblings);
    }
    const group =
      [...ancestors]
        .reverse()
        .find((a) => ["chapter", "appendix"].includes(a.kind)) ?? n;
    const omit = (body || legacyOmit) && n !== root;
    const { level, headingLevel } = readingLevels(
      n,
      root || undefined,
      ancestors,
      target,
      omit,
    );
    plan.set(n.id, {
      headingLevel,
      bodyOffset: Math.max(0, level - 1),
      parent,
      group,
      omit,
      inContents: true,
    });
    if (n.kind !== "piece") ancestors.push(n);
  }
  applyReadingParts(bodyGroups, plan);
  return plan;
}

function applyReadingParts<T extends ReadingNode>(
  bodyGroups: Map<string, T[]>,
  plan: Map<
    string,
    { inContents: boolean; readingPart?: { position: number; total: number } }
  >,
) {
  for (const siblings of bodyGroups.values()) {
    for (const [i, n] of siblings.entries()) {
      const entry = plan.get(n.id)!;
      entry.inContents = siblings.length > 1;
      entry.readingPart = { position: i + 1, total: siblings.length };
    }
  }
}

function validateIntegration(
  n: ReadingNode,
  parent: ReadingNode | undefined,
  body: boolean,
  legacyOmit: boolean,
) {
  if (
    (body || legacyOmit) &&
    (n.kind !== "piece" ||
      !parent ||
      !["chapter", "appendix"].includes(parent.kind))
  )
    throw Error(
      `Body integration or omitted book heading requires a piece directly inside a chapter or appendix: ${n.id}`,
    );
  if (n.integration && n.bookHeading && body !== (n.bookHeading === "omit"))
    throw Error(`Conflicting integration and bookHeading: ${n.id}`);
}
function readingLevels(
  n: ReadingNode,
  root: ReadingNode | undefined,
  ancestors: ReadingNode[],
  target: string,
  omit: boolean,
) {
  const level =
    n.depth === 0 && !root
      ? 1
      : n.depth +
        (root ? 1 - root.depth : target === "web" ? 1 : 0) -
        (target === "book"
          ? ancestors.filter((a) => a.kind === "part").length
          : 0) -
        Number(omit);
  // Only validate levels belonging to the selected view. Ancestors and peers
  // still supply relationship/navigation context, but aren't emitted here.
  const inView = !root || n === root || ancestors.includes(root);
  const headingLevel = omit || (n.depth === 0 && !root) ? null : level;
  if (inView && (level < 1 || level > 6))
    throw Error(`Reading heading depth exceeds supported levels: ${n.id}`);
  return { level, headingLevel };
}

export function sourceHeadingLevel(source: number, offset: number, id: string) {
  const level = source + offset;
  if (
    !Number.isInteger(source) ||
    !Number.isInteger(level) ||
    source < 2 ||
    source > 6 ||
    level > 6 ||
    level < 2
  )
    throw Error(`Reading heading depth exceeds supported levels: ${id}`);
  return level as 2 | 3 | 4 | 5 | 6;
}
