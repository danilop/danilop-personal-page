export type RuntimeInput = { initial: number; rate: number; steps: number };
export type RecordedRun = {
  runtime: string;
  version: string;
  input: unknown;
  output: unknown;
  capturedAt: string;
};
export interface ExperimentSession {
  run(input: RuntimeInput, signal: AbortSignal): Promise<number[]>;
  stop(): void;
  reset(): void;
  dispose(): void;
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
}
export interface ModelRuntime {
  id: string;
  version: string;
  locality: "local";
  formats: string[];
  probe(
    model: ModelDescriptor,
  ): Promise<{ supported: boolean; reason?: string }>;
  load(
    model: ModelDescriptor,
    progress: (text: string) => void,
    signal: AbortSignal,
  ): Promise<ModelSession>;
  clear(model: ModelDescriptor): Promise<void>;
}
export type ModelDescriptor = {
  id: string;
  runtime: string;
  format: string;
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
