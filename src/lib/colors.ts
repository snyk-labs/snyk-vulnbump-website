/**
 * Mark colour per configuration (2b theme). The highlighted configuration is
 * solid purple; the others are the same purple at fixed lower opacity, so
 * identity never depends on rank. Labels and legends always accompany these.
 *
 * The steps are assigned in reverse data order, so the configuration listed
 * next to the highlighted one (Claude Code + Snyk scan) takes the stronger
 * step and the first (Claude Code unaided) the weaker, as the design specifies.
 */
const steps = ["var(--series-muted-strong)", "var(--series-muted)"];
const opacitySteps = ["var(--pass-op-2)", "var(--pass-op-3)"];

/**
 * The non-agentic baseline is drawn as an outline (dashed where the mark allows),
 * never filled, so it reads as a reference rather than a competitor.
 */
export const BASELINE_COLOR = "var(--series-baseline)";

/** Opacity of the pass colour per config, for bars that use --pass + opacity. */
export const PASS_OPACITY = ["var(--pass-op-1)", "var(--pass-op-2)", "var(--pass-op-3)"];

function assign(
  configurations: { id: string; highlight: boolean }[],
  highlight: string,
  rest: string[],
): Record<string, string> {
  const out: Record<string, string> = {};
  let i = 0;
  for (const c of [...configurations].reverse()) {
    out[c.id] = c.highlight ? highlight : rest[i++ % rest.length]!;
  }
  return out;
}

export function configColors(
  configurations: { id: string; highlight: boolean }[],
): Record<string, string> {
  return assign(configurations, "var(--series-highlight)", steps);
}

/** `--op` per configuration: 1 for the highlighted one, then the fixed steps. */
export function passOpacity(
  configurations: { id: string; highlight: boolean }[],
): Record<string, string> {
  return assign(configurations, "var(--pass-op-1)", opacitySteps);
}

/** Display order: the highlighted configuration first, then the rest from strongest to weakest. */
export function displayOrder<T extends { highlight: boolean }>(configurations: T[]): T[] {
  return [...configurations.filter((c) => c.highlight), ...configurations.filter((c) => !c.highlight).reverse()];
}
