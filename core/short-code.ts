export const reservedShortCodes = [
  "api",
  "assets",
  "media",
  "www",
  "admin",
  "index",
  "not-found",
];

// A modest editorial stop list, not a claim about worldwide word frequencies.
const commonWords = new Set(
  `
  a an and are as at be been being but by can could did do does for from had has
  have how i if in into is it its may might more most my no not of on or our out
  should so some than that the their them then there these they this those through
  to too up us was we were what when where which who why will with would you your
  about after before enough find first getting guide introduction learn making
  need new notes using use very way ways
  che chi come con da dal dei del della delle di e gli i il in la le lo ma nel
  nella non o per piu quando questo si sono su sul tra un una uno
`
    .split(/\s+/)
    .filter(Boolean),
);

function words(title: string) {
  return [
    ...new Set(
      title
        .toLowerCase()
        .normalize("NFKD")
        .replace(/\p{M}/gu, "")
        .replace(/[’']/g, "")
        .match(/[a-z0-9]+/g) ?? [],
    ),
  ].filter((word) => word.length >= 2 && !/^\d+$/.test(word));
}

/** Suggest only: reservation and remote ownership checks remain separate. */
export function suggestShortCode(
  title: string,
  identity: string,
  titles: string[],
  occupied: Iterable<string>,
) {
  const frequencies = new Map<string, number>();
  for (const other of titles)
    for (const word of words(other))
      frequencies.set(word, (frequencies.get(word) ?? 0) + 1);
  const selected = words(title)
    .filter((word) => !commonWords.has(word))
    .map((word, position) => ({
      word,
      position,
      frequency: frequencies.get(word) ?? 0,
    }))
    .sort((a, b) => a.frequency - b.frequency || a.position - b.position)
    .slice(0, 2)
    .sort((a, b) => a.position - b.position)
    .map(({ word }) => word);
  const base = (selected.join("-") || identity || "article")
    .slice(0, 48)
    .replace(/-+$/, "");
  const taken = new Set([...occupied, ...reservedShortCodes]);
  let candidate = base;
  for (let suffix = 2; taken.has(candidate); suffix++)
    candidate = `${base}-${suffix}`;
  return candidate;
}
