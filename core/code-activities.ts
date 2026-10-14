import { createHash } from "node:crypto";
import { z } from "zod";
import { visit } from "unist-util-visit";
import type { Root } from "mdast";

const activitySchema = z
  .object({
    id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    title: z.string().min(1).max(120),
    codeSha256: z.string().regex(/^[a-f0-9]{64}$/),
    runtime: z.literal("python"),
    demo: z
      .object({
        module: z.literal("tally"),
        count: z.number().int().min(0).max(50),
      })
      .strict()
      .optional(),
  })
  .strict();
export type CodeActivity = z.infer<typeof activitySchema>;
export const codeHash = (code: string) =>
  createHash("sha256").update(code).digest("hex");

export function validateCodeActivities(
  value: unknown,
  ast: Root,
): CodeActivity[] {
  const { activities } = z
    .object({
      schemaVersion: z.literal(1),
      activities: z.array(activitySchema).min(1),
    })
    .strict()
    .parse(value);
  const ids = new Set<string>();
  const hashes = new Set<string>();
  for (const activity of activities) {
    if (ids.has(activity.id) || hashes.has(activity.codeSha256))
      throw Error("Duplicate code activity ID or source hash");
    ids.add(activity.id);
    hashes.add(activity.codeSha256);
    let matches = 0;
    visit(ast, "code", (node) => {
      if (
        node.lang === "python" &&
        codeHash(node.value) === activity.codeSha256
      )
        matches++;
    });
    if (matches !== 1)
      throw Error(
        `Code activity ${activity.id} must match exactly one Python fence; review the source and its hash`,
      );
  }
  return activities;
}
