/** Input schemas are a small JSON Schema subset, validated without a library. */
type Property =
  | { type: "string"; description: string; maxLength?: number; enum?: string[] }
  | { type: "integer"; description: string; minimum?: number; maximum?: number }
  | { type: "boolean"; description: string };
export type InputSchema = {
  type: "object";
  properties: Record<string, Property>;
  required?: string[];
  additionalProperties: false;
};
type Caller = "webmcp" | "assistant";
export type ToolContext = { caller: Caller; signal?: AbortSignal };
export type AgentTool = {
  name: string;
  title: string;
  /** Written for models: what it does, when to use it and its limits. */
  description: string;
  inputSchema: InputSchema;
  annotations: { readOnlyHint?: boolean; untrustedContentHint?: boolean };
  available(doc: Document): boolean;
  execute(input: Record<string, unknown>, ctx: ToolContext): Promise<unknown>;
};

/** A failure the model should read and recover from, not a crash. */
export class ToolError extends Error {}

const MAX_RESULT = 8000;

function checkString(
  key: string,
  rule: Property & { type: "string" },
  v: unknown,
) {
  if (typeof v !== "string") throw new ToolError(`"${key}" must be text.`);
  if (rule.maxLength && v.length > rule.maxLength)
    throw new ToolError(`"${key}" is longer than ${rule.maxLength}.`);
  if (rule.enum && !rule.enum.includes(v))
    throw new ToolError(`"${key}" must be one of: ${rule.enum.join(", ")}.`);
}
function checkInteger(
  key: string,
  rule: Property & { type: "integer" },
  v: unknown,
) {
  if (!Number.isInteger(v))
    throw new ToolError(`"${key}" must be a whole number.`);
  const n = v as number;
  if ((rule.minimum ?? n) > n || (rule.maximum ?? n) < n)
    throw new ToolError(
      `"${key}" must be between ${rule.minimum} and ${rule.maximum}.`,
    );
}
function checkProperty(key: string, rule: Property, v: unknown) {
  if (rule.type === "string") checkString(key, rule, v);
  else if (rule.type === "integer") checkInteger(key, rule, v);
  else if (typeof v !== "boolean")
    throw new ToolError(`"${key}" must be true or false.`);
}

export function validateInput(
  schema: InputSchema,
  input: unknown,
): Record<string, unknown> {
  const value = (input ?? {}) as Record<string, unknown>;
  if (typeof value !== "object" || Array.isArray(value))
    throw new ToolError("Input must be an object.");
  for (const key of Object.keys(value))
    if (!(key in schema.properties))
      throw new ToolError(`Unknown input "${key}".`);
  for (const key of schema.required ?? [])
    if (value[key] === undefined || value[key] === "")
      throw new ToolError(`"${key}" is required.`);
  for (const [key, rule] of Object.entries(schema.properties))
    if (value[key] !== undefined) checkProperty(key, rule, value[key]);
  return value;
}

/** Trim long text fields so a tool result stays within its budget. */
export function capResult(result: unknown): unknown {
  const text = JSON.stringify(result);
  if (text === undefined || text.length <= MAX_RESULT) return result;
  if (result && typeof result === "object" && "text" in result) {
    const r = result as { text: string };
    const excess = text.length - MAX_RESULT + 40;
    return {
      ...r,
      text: r.text.slice(0, Math.max(0, r.text.length - excess)) + "…",
      truncated: true,
    };
  }
  throw new ToolError("The result is too large; ask for something narrower.");
}

export type ToolOutcome =
  { ok: true; result: unknown } | { ok: false; error: string };

/** Validate, run and cap a tool; errors become short model-readable text. */
export async function runTool(
  tool: AgentTool,
  input: unknown,
  ctx: ToolContext,
): Promise<ToolOutcome> {
  let outcome: ToolOutcome;
  try {
    const result = capResult(
      await tool.execute(validateInput(tool.inputSchema, input), ctx),
    );
    outcome = { ok: true, result };
  } catch (error) {
    outcome = {
      ok: false,
      error:
        error instanceof ToolError
          ? error.message
          : "The tool failed in the browser. Try again or use the page directly.",
    };
    if (!(error instanceof ToolError)) console.error(error);
  }
  document.dispatchEvent(
    new CustomEvent("notes:agent-tool", {
      detail: { tool: tool.name, caller: ctx.caller, ok: outcome.ok },
    }),
  );
  return outcome;
}
