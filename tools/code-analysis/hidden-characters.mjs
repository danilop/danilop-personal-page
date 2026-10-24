import fs from "node:fs";
import path from "node:path";
import { root } from "./run.mjs";

// Invisible and direction-changing characters have no place in published text,
// including code, quotations and notes that the prose checks skip.
const ranges = [
  [0x00, 0x08],
  [0x0b, 0x0c],
  [0x0e, 0x1f],
  [0x7f, 0x9f],
  [0xad, 0xad],
  [0x61c, 0x61c],
  [0x180e, 0x180e],
  [0x200b, 0x200f],
  [0x2028, 0x202e],
  [0x2060, 0x2064],
  [0x2066, 0x206f],
  [0xfeff, 0xfeff],
  [0xfff9, 0xfffb],
  [0xe0000, 0xe007f],
];
const hidden = new RegExp(
  `[${ranges.map(([a, b]) => `\\u{${a.toString(16)}}-\\u{${b.toString(16)}}`).join("")}]`,
  "gu",
);
let found = 0;
for (const file of process.argv.slice(2)) {
  const lines = fs.readFileSync(path.join(root, file), "utf8").split("\n");
  lines.forEach((line, index) => {
    for (const match of line.matchAll(hidden)) {
      const code = match[0].codePointAt(0).toString(16).toUpperCase();
      console.log(
        `${file}:${index + 1}:${match.index + 1} U+${code.padStart(4, "0")}`,
      );
      found++;
    }
  });
}
if (found) {
  console.log(
    `${found} hidden characters. Remove them; see docs/writing-style.md.`,
  );
  process.exitCode = 1;
}
