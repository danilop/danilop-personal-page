import fs from "node:fs/promises";
import { z } from "zod";
import type { Agent } from "./author-review";

// Codex requires every property to be required; optional fields become nullable.
function codexSchema(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(codexSchema);
  if (!value || typeof value !== "object") return value;
  const node = Object.fromEntries(
    Object.entries(value).map(([key, child]) => [key, codexSchema(child)]),
  );
  if (node.type === "object" && node.properties) {
    const required = new Set((node.required as string[]) || []);
    const properties = node.properties as Record<string, unknown>;
    for (const key of Object.keys(properties))
      if (!required.has(key))
        properties[key] = { anyOf: [properties[key], { type: "null" }] };
    node.required = Object.keys(properties);
    node.additionalProperties = false;
  }
  return node;
}

export async function structuredArgs(
  agent: Agent,
  base: string[],
  schema: z.ZodType,
  output: string,
) {
  const args = [...base];
  const json = z.toJSONSchema(schema, { target: "draft-7" });
  if (agent === "claude") {
    args[args.indexOf("--output-format") + 1] = "json";
    args.push("--json-schema", JSON.stringify(json));
  } else if (agent === "codex") {
    const file = output + ".schema.json";
    await fs.writeFile(file, JSON.stringify(codexSchema(json)), {
      mode: 0o600,
    });
    args.splice(args.length - 1, 0, "--output-schema", file);
  } else args[args.indexOf("--mode") + 1] = "json";
  return args;
}

export function parseStructuredJSON(text: string): unknown {
  try {
    return JSON.parse(
      text
        .trim()
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/, ""),
    );
  } catch {
    throw Error(
      "The agent returned malformed or multiple JSON proposals. Nothing was applied; retry the request.",
    );
  }
}

export function claudeStructuredResult(stdout: string) {
  let raw: unknown;
  try {
    raw = JSON.parse(stdout);
  } catch {
    throw Error("Claude returned malformed result JSON. Nothing was applied.");
  }
  const envelope = z
    .object({
      type: z.literal("result"),
      subtype: z.string(),
      is_error: z.boolean(),
      structured_output: z.unknown().optional(),
    })
    .safeParse(raw);
  if (!envelope.success)
    throw Error(
      "Claude returned an invalid result envelope. Nothing was applied.",
    );
  const result = envelope.data;
  if (result.is_error || result.subtype !== "success")
    throw Error(
      `Claude did not complete the structured response (${result.subtype}). Nothing was applied.`,
    );
  if (result.structured_output === undefined)
    throw Error(
      "Claude returned no structured response. Retry with a current Claude CLI. Nothing was applied.",
    );
  return JSON.stringify(result.structured_output);
}

function piEvent(line: string) {
  try {
    return z.record(z.string(), z.unknown()).parse(JSON.parse(line));
  } catch {
    throw Error(
      "Pi returned a malformed JSON event stream. Nothing was applied.",
    );
  }
}

function piAssistantMessage(raw: unknown) {
  const message = z
    .object({
      role: z.string(),
      stopReason: z.string().optional(),
      content: z.unknown(),
    })
    .parse(raw);
  if (message.role !== "assistant") return undefined;
  return z
    .object({
      stopReason: z.string(),
      content: z.array(
        z.object({ type: z.string(), text: z.string().optional() }),
      ),
    })
    .parse(message);
}

type PiState = {
  settled: boolean;
  final?: ReturnType<typeof piAssistantMessage>;
};
function updatePiState(state: PiState, event: Record<string, unknown>) {
  switch (event.type) {
    case "agent_start":
    case "turn_start":
    case "message_start":
      state.settled = false;
      state.final = undefined;
      break;
    case "message_end":
      state.final = piAssistantMessage(event.message) ?? state.final;
      break;
    case "agent_end":
      if (event.willRetry === true) {
        state.settled = false;
        state.final = undefined;
      }
      break;
    case "error":
      throw Error("Pi reported a failed response. Nothing was applied.");
    case "agent_settled":
      state.settled = true;
      break;
  }
}

export function piFinalAnswer(stdout: string) {
  const state: PiState = { settled: false };
  for (const line of stdout.split("\n"))
    if (line.trim()) updatePiState(state, piEvent(line));
  const { settled, final } = state;
  if (!settled || !final || final.stopReason !== "stop")
    throw Error(
      "Pi did not return a complete final answer. Nothing was applied; retry with a current Pi CLI.",
    );
  const answer = final.content
    .filter((block) => block.type === "text")
    .map((block) => block.text ?? "")
    .join("");
  if (!answer.trim())
    throw Error("Pi returned an empty final answer. Nothing was applied.");
  return answer;
}

export async function structuredAnswer(
  agent: Agent,
  stdout: string,
  output: string,
) {
  if (agent === "codex") return fs.readFile(output, "utf8");
  if (agent === "claude") return claudeStructuredResult(stdout);
  return piFinalAnswer(stdout);
}
