import { validateInput, type RuntimeInput } from "./contracts";
// A minimal WebAssembly module exporting f64 multiplication. The JS and WASM
// adapters compute the same recurrence; the module has no imports or host access.
const multiplyWasm = new Uint8Array([
  0, 97, 115, 109, 1, 0, 0, 0, 1, 7, 1, 96, 2, 124, 124, 1, 124, 3, 2, 1, 0, 7,
  7, 1, 3, 109, 117, 108, 0, 0, 10, 9, 1, 7, 0, 32, 0, 32, 1, 162, 11,
]);
export async function simulate(input: RuntimeInput, backend: "js" | "wasm") {
  validateInput(input);
  let multiply = (a: number, b: number) => a * b;
  if (backend === "wasm") {
    const { instance } = await WebAssembly.instantiate(multiplyWasm);
    multiply = instance.exports.mul as typeof multiply;
  }
  const values = [input.initial];
  for (let i = 0; i < input.steps; i++)
    values.push(multiply(values.at(-1)!, 1 + input.rate / 100));
  return values;
}
