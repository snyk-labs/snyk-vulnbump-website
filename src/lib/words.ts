const words = ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];

/** "Three" for 3; falls back to digits past ten. */
export function countWord(n: number): string {
  return words[n] ?? String(n);
}

/** "a", "a and b", "a, b and c". */
export function listWords(items: string[]): string {
  if (items.length < 2) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

/**
 * Authors grouped by shared affiliation, in order:
 * "A, B and C (Snyk) and D (Brown University and Snyk)".
 */
export function authorLine(authors: { name: string; affiliations: string[] }[]): string {
  const groups: { names: string[]; where: string }[] = [];
  for (const { name, affiliations } of authors) {
    const where = listWords(affiliations);
    const last = groups.at(-1);
    if (last?.where === where) last.names.push(name);
    else groups.push({ names: [name], where });
  }
  return groups.map((g) => `${listWords(g.names)} (${g.where})`).join(groups.length > 2 ? "; " : " and ");
}

/** Zero-padded index label: 1 → "01". */
export function indexLabel(i: number): string {
  return String(i + 1).padStart(2, "0");
}
