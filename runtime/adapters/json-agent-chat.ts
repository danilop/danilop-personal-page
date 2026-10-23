import type { AgentChat, AgentStep, AgentToolSpec } from "../contracts";

/**
 * Tool use for models without native tool calling: each reply is JSON naming one
 * tool and its input, constrained by a schema where the runtime supports it,
 * then validated here and retried once.
 */
export function toolGuide(tools: AgentToolSpec[]) {
  return (
    "\n\nReply only with JSON of the form " +
    '{"tool": "<name>", "input": {...}}. Available tools:\n' +
    tools
      .map(
        (t) =>
          `- ${t.name}: ${t.description} Input schema: ${JSON.stringify(t.inputSchema)}`,
      )
      .join("\n")
  );
}

export const stepSchema = (tools: AgentToolSpec[]) => ({
  type: "object",
  properties: {
    tool: { type: "string", enum: tools.map((t) => t.name) },
    input: { type: "object" },
  },
  required: ["tool", "input"],
});

/** Parse a JSON step, tolerating code fences and a leading think block. */
function parseStep(raw: string, tools: AgentToolSpec[]): AgentStep | undefined {
  const cleaned = raw
    .replace(/<think>[\s\S]*?<\/think>/, "")
    .replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, "")
    .trim();
  try {
    const value = JSON.parse(cleaned) as { tool?: unknown; input?: unknown };
    if (
      typeof value.tool === "string" &&
      tools.some((t) => t.name === value.tool) &&
      value.input &&
      typeof value.input === "object" &&
      !Array.isArray(value.input)
    )
      return {
        call: {
          name: value.tool,
          input: value.input as Record<string, unknown>,
        },
      };
  } catch {
    /* Not JSON: retried, then returned as text. */
  }
}

export function jsonAgentChat(
  prompt: (text: string, signal: AbortSignal) => Promise<string>,
  tools: AgentToolSpec[],
  dispose: () => Promise<void>,
): AgentChat {
  return {
    async send(input, signal) {
      let text =
        "user" in input
          ? input.user
          : `Result of ${input.toolResult.name}:\n${JSON.stringify(input.toolResult.result)}`;
      for (let attempt = 0; attempt < 2; attempt++) {
        const raw = await prompt(text, signal);
        const step = parseStep(raw, tools);
        if (step) return step;
        if (attempt === 1) return { text: raw };
        text =
          'That reply was not valid. Reply only with JSON {"tool": "<name>", "input": {...}} using one of the available tools.';
      }
      throw Error("unreachable");
    },
    dispose,
  };
}
