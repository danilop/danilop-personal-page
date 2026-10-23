import type { ModelRuntime } from "./contracts";
import { webllm } from "./adapters/webllm";
import { promptApi } from "./adapters/prompt-api";
import { litertLm } from "./adapters/litert-lm";
export const modelRuntimes: Record<string, ModelRuntime> = {
  webllm,
  "prompt-api": promptApi,
  "litert-lm": litertLm,
};
