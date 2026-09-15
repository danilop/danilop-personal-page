import type { ModelRuntime } from "./contracts";
import { webllm } from "./adapters/webllm";
export const modelRuntimes: Record<string, ModelRuntime> = { webllm };
