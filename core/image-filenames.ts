import path from "node:path";

export function imageFilenameStem(description: string) {
  const subject = description
    .trim()
    .replace(
      /^(?:(?:a|an)\s+)?(?:(?:blue[- ]ink|pen[- ]and[- ]ink)\s+)?(?:illustration|drawing|image|photo(?:graph)?|picture)\s+(?:of\s+)?/i,
      "",
    );
  const words = subject
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(
      (word) =>
        word && !/^(a|an|the|of|and|with|in|on|at|to|from|for)$/.test(word),
    );
  return words.slice(0, 8).join("-").slice(0, 80).replace(/-+$/, "") || "image";
}

export function imageAssetStem(file: string) {
  return imageFilenameStem(
    path.basename(file, path.extname(file)).replace(/-[a-f0-9]{12,64}$/i, ""),
  );
}
