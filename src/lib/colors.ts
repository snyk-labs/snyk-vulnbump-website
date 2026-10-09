/**
 * Mark colour per configuration. The highlighted configuration is Hot Pink;
 * the others take muted white steps in data order, so identity never depends
 * on rank. Labels and legends always accompany these colours.
 */
const mutedSteps = ["var(--series-muted)", "var(--series-muted-strong)"];

/**
 * The non-agent baseline is drawn as an outline (dashed where the mark allows),
 * never filled, so it reads as a reference rather than a competitor.
 */
export const BASELINE_COLOR = "var(--series-baseline)";

export function configColors(
  configurations: { id: string; highlight: boolean }[],
): Record<string, string> {
  const colors: Record<string, string> = {};
  let muted = 0;
  for (const c of configurations) {
    colors[c.id] = c.highlight
      ? "var(--series-highlight)"
      : mutedSteps[muted++ % mutedSteps.length]!;
  }
  return colors;
}
