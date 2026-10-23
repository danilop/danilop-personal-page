export type RuntimeInput = { initial: number; rate: number; steps: number };
export type RecordedRun = {
  runtime: string;
  version: string;
  input: unknown;
  output: unknown;
  capturedAt: string;
};
/** A tool offered to the model; same shape as the agent tool registry. */
export type AgentToolSpec = {
  name: string;
  description: string;
  inputSchema: object;
};
/** What the assistant loop sends to the model next. */
type AgentInput =
  { user: string } | { toolResult: { name: string; result: unknown } };
/** The model's next move: a tool call, or plain text when it calls none. */
export type AgentStep =
  { call: { name: string; input: Record<string, unknown> } } | { text: string };
/** One question's conversation; history stays inside the runtime. */
export interface AgentChat {
  send(input: AgentInput, signal: AbortSignal): Promise<AgentStep>;
  dispose(): Promise<void>;
}
export interface ModelSession {
  run(
    prompt: string,
    onToken: (text: string) => void,
    signal: AbortSignal,
  ): Promise<string>;
  stop(): void;
  reset(): Promise<void>;
  dispose(): Promise<void>;
  /** Tool-using conversations for the reading assistant, where supported. */
  startAgentChat?(system: string, tools: AgentToolSpec[]): Promise<AgentChat>;
}
export interface ModelRuntime {
  id: string;
  version: string;
  locality: "local";
  formats: string[];
  probe(model: ModelDescriptor): Promise<{
    supported: boolean;
    reason?: string;
    /** True when the model must be downloaded before use. */
    download?: boolean;
  }>;
  load(
    model: ModelDescriptor,
    progress: (text: string) => void,
    signal: AbortSignal,
  ): Promise<ModelSession>;
  clear(model: ModelDescriptor): Promise<void>;
}
type ModelBase = {
  id: string;
  runtime: string;
  format: string;
  label?: string;
};
/** WebLLM: MLC weights and a WebGPU library pinned by revision and hash. */
export type WebLlmModel = ModelBase & {
  model: string;
  modelLib: string;
  integrity?: {
    config?: string;
    model_lib?: string;
    tokenizer?: Record<string, string>;
    onFailure?: "error";
  };
  downloadBytes: number;
  vramMB: number;
  requiredFeatures: string[];
  revision: string;
  artifacts: { path: string; bytes: number; sha256?: string }[];
};
/** A model the browser provides and versions itself (Prompt API). */
export type BuiltinModel = ModelBase & {
  runtime: "prompt-api";
  format: "builtin";
  languages: string[];
};
/** One .litertlm file at a pinned revision (LiteRT-LM). */
export type LiteRtModel = ModelBase & {
  runtime: "litert-lm";
  format: "litertlm";
  model: string;
  revision: string;
  downloadBytes: number;
  sha256: string;
  vramMB: number;
  requiredFeatures: string[];
};
export type ModelDescriptor = WebLlmModel | BuiltinModel | LiteRtModel;
/** Download size and memory for display; browser-provided models have none. */
export function modelSummary(model: ModelDescriptor) {
  if (model.format === "builtin")
    return `${model.label ?? model.id}, provided by this browser.`;
  const m = model as WebLlmModel | LiteRtModel;
  return `${m.label ?? m.id}. Download approximately ${Math.ceil(m.downloadBytes / 1024 / 1024)} MB; estimated GPU memory ${Math.ceil(m.vramMB)} MB.`;
}
export function downloadRecord(name: string, record: RecordedRun) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(record, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name + ".json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function validateInput(v: RuntimeInput) {
  if (
    !Number.isFinite(v.initial) ||
    v.initial < 1 ||
    v.initial > 1000 ||
    !Number.isFinite(v.rate) ||
    v.rate < -50 ||
    v.rate > 100 ||
    !Number.isInteger(v.steps) ||
    v.steps < 1 ||
    v.steps > 200
  )
    throw Error(
      "Use starting values 1–1000, growth −50–100%, and 1–200 steps.",
    );
  return v;
}
