export function selectCode(source: string, region?: string) {
  if (!region) return source;
  const lines = source.split("\n");
  const start = lines.findIndex(
    (l) => l.includes(`region ${region}`) && !l.includes(`endregion ${region}`),
  );
  const end = lines.findIndex(
    (l, i) => i > start && l.includes(`endregion ${region}`),
  );
  if (start < 0 || end < 0) throw Error(`Missing named region ${region}`);
  return lines.slice(start + 1, end).join("\n");
}
