import { simulate } from "./growth";
import type { RuntimeInput } from "./contracts";
export type ExperimentInput = Record<string, number>;
export type ExperimentDefinition = {
  id: string;
  version: string;
  fields: {
    name: string;
    label: string;
    min: number;
    max: number;
    step: number;
    initial: number;
  }[];
  run(input: ExperimentInput): Promise<number[]>;
  summary(input: ExperimentInput, values: number[]): string;
};
const fields = [
  {
    name: "initial",
    label: "Starting value",
    min: 1,
    max: 1000,
    step: 1,
    initial: 100,
  },
  {
    name: "rate",
    label: "Growth per step (%)",
    min: -50,
    max: 100,
    step: 0.1,
    initial: 5,
  },
  { name: "steps", label: "Steps", min: 1, max: 200, step: 1, initial: 20 },
];
const growth = (backend: "js" | "wasm"): ExperimentDefinition => ({
  id: "growth-" + backend,
  version: "1",
  fields,
  run: (input) => simulate(input as RuntimeInput, backend),
  summary: (input, values) =>
    `After ${input.steps} steps: ${values.at(-1)!.toFixed(2)}`,
});
export const experiments: Record<string, ExperimentDefinition> = {
  "growth-js": growth("js"),
  "growth-wasm": growth("wasm"),
};
export function validateExperiment(
  definition: ExperimentDefinition,
  input: ExperimentInput,
) {
  for (const f of definition.fields) {
    const v = input[f.name];
    if (
      !Number.isFinite(v) ||
      v < f.min ||
      v > f.max ||
      (f.step === 1 && !Number.isInteger(v))
    )
      throw Error(
        `${f.label}: use ${f.min}–${f.max}${f.step === 1 ? " in whole numbers" : ""}.`,
      );
  }
  return input;
}
