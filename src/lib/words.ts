const words = ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];

/** "Three" for 3; falls back to digits past ten. */
export function countWord(n: number): string {
  return words[n] ?? String(n);
}

/** Zero-padded index label: 1 → "01". */
export function indexLabel(i: number): string {
  return String(i + 1).padStart(2, "0");
}
