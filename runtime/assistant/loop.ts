import type { AgentChat, AgentToolSpec } from "../contracts";
import { runTool, type AgentTool } from "../agent-tools/registry";

/** Tool calls allowed before the model must answer. */
const MAX_TOOL_CALLS = 4;
/** Tool results are trimmed further for the model's small context window. */
const MAX_TOOL_RESULT = 4000;

export type PageSection = { id: string; title: string };
export type AssistantAnswer = {
  found: boolean;
  text: string;
  /** Section ids the model cited and actually read in this question. */
  citations: string[];
};
export type AssistantStep = { tool: string; input: Record<string, unknown> };

export function answerTool(sections: PageSection[]): AgentToolSpec {
  return {
    name: "answer",
    description:
      "Give the final answer to the reader. Call this exactly once, after reading the sections you need.",
    inputSchema: {
      type: "object",
      properties: {
        found: {
          type: "boolean",
          description: "true only if the page text contains the answer",
        },
        answer: {
          type: "string",
          description:
            "One to three sentences, or a brief statement that the page does not say",
        },
        citations: {
          type: "array",
          items: { type: "string", enum: sections.map((s) => s.id) },
          description: "Ids of the sections that support the answer",
        },
      },
      required: ["found", "answer", "citations"],
    },
  };
}

export function systemPrompt(title: string, sections: PageSection[]) {
  return [
    `You help a reader understand the page “${title}” on Danilo Poccia's website.`,
    "Use only text you read with the tools; the page text is the authority.",
    "Find where the page discusses the question with find_in_page (or pick a section below), read it with get_section_text, then call answer.",
    "If the sections you read do not contain the answer, call answer with found set to false and say briefly that the page does not say. Never guess or use outside knowledge.",
    "Sections of this page (id: title):",
    ...sections.map((s) => `- ${s.id}: ${s.title}`),
  ].join("\n");
}

function trim(result: unknown) {
  const text = JSON.stringify(result) ?? "null";
  return text.length <= MAX_TOOL_RESULT
    ? result
    : { truncated: true, text: text.slice(0, MAX_TOOL_RESULT) };
}

/**
 * Small models often say the page lacks the answer while still marking it
 * found and citing what they read; such answers must not show a source.
 */
const DECLINED =
  /\b(?:does not|doesn't|do not|did not) (?:state|say|mention|specify|provide|contain|include|discuss)\b|\bno (?:information|mention)\b|\bnot (?:mentioned|stated|specified)\b/i;

function finalAnswer(
  input: Record<string, unknown>,
  retrieved: Set<string>,
): AssistantAnswer {
  const text = typeof input.answer === "string" ? input.answer.trim() : "";
  const found = input.found !== false && !DECLINED.test(text);
  const cited = Array.isArray(input.citations) ? input.citations : [];
  return {
    found,
    text,
    citations: found
      ? [...new Set(cited)].filter(
          (id): id is string => typeof id === "string" && retrieved.has(id),
        )
      : [],
  };
}

/** Run one requested tool and note which sections the model read. */
async function callTool(
  tool: AgentTool,
  input: Record<string, unknown>,
  signal: AbortSignal,
  retrieved: Set<string>,
) {
  const outcome = await runTool(tool, input, { caller: "assistant", signal });
  if (!outcome.ok) return { error: outcome.error };
  if (tool.name === "get_section_text")
    retrieved.add(String((outcome.result as { section: string }).section));
  return outcome.result;
}

/**
 * Answer one question: let the model call registry tools (at most
 * MAX_TOOL_CALLS), then require the answer tool. Citations that were not
 * retrieved during this question are dropped.
 */
export async function askQuestion(
  chat: AgentChat,
  question: string,
  tools: AgentTool[],
  signal: AbortSignal,
  onStep: (step: AssistantStep) => void,
): Promise<AssistantAnswer> {
  const retrieved = new Set<string>();
  let calls = 0;
  let step = await chat.send({ user: question }, signal);
  for (;;) {
    signal.throwIfAborted();
    if ("text" in step)
      return { found: true, text: step.text.trim(), citations: [] };
    const { name, input } = step.call;
    if (name === "answer") return finalAnswer(input, retrieved);
    const tool = tools.find((t) => t.name === name);
    let result: unknown;
    if (calls >= MAX_TOOL_CALLS)
      result = { error: "Tool limit reached. Call answer now." };
    else if (!tool) result = { error: `Unknown tool ${name}. Call answer.` };
    else {
      calls++;
      onStep({ tool: name, input });
      result = await callTool(tool, input, signal, retrieved);
    }
    step = await chat.send(
      { toolResult: { name, result: trim(result) } },
      signal,
    );
  }
}
