import raw from "./benchmark.json";
import { displayOrder, passOpacity } from "../lib/colors";
import { benchmarkSchema, type Configuration, type Metric } from "./schema";

/** Parsed at build time; an invalid dataset fails `astro build`. */
export const benchmark = benchmarkSchema.parse(raw);

export function getMetric(key: string): Metric {
  const metric = benchmark.metrics.find((m) => m.key === key);
  if (!metric) throw new Error(`Unknown metric "${key}"`);
  return metric;
}

/** The configuration the benchmark is about (validated to be exactly one). */
export const highlighted: Configuration = benchmark.configurations.find(
  (c) => c.highlight,
)!;

/** The non-agentic baseline: applies Snyk's recommended version and nothing else. */
export const bump = benchmark.baseline;

/** Every configuration except the highlighted one, in data order. */
export const baselines: Configuration[] = benchmark.configurations.filter(
  (c) => !c.highlight,
);

export function ecosystemLabel(id: string): string {
  return benchmark.ecosystems.find((e) => e.id === id)?.label ?? id;
}

/**
 * Lanes for the gate funnel, in display order: the highlighted agent, the
 * other agents from strongest to weakest, then the non-agentic baseline.
 */
export function funnelLanes() {
  const op = passOpacity(benchmark.configurations);
  return [
    ...displayOrder(benchmark.configurations).map((c) => ({
      id: c.id,
      label: c.label,
      subtitle: c.subtitle,
      highlight: c.highlight,
      flow: c.flow,
      op: op[c.id]!,
    })),
    {
      id: bump.id,
      label: bump.label,
      subtitle: bump.subtitle,
      highlight: false,
      baseline: true,
      flow: bump.flow,
      op: "1",
    },
  ];
}

/** Title and description of each gate, in order, for the funnel's detail row. */
export const gateDetails = benchmark.metrics
  .filter((m) => m.kind === "gate")
  .map((m) => ({ label: m.label, description: m.description }));

export function configById(id: string): Configuration {
  const config = benchmark.configurations.find((c) => c.id === id);
  if (!config) throw new Error(`Unknown configuration "${id}"`);
  return config;
}

/**
 * Failed attempts by the first gate they failed (paper Figure 4): the drop at
 * each step of the gate flow, labelled with that step's drop label.
 */
export function firstFailedGates(c: { flow: number[] }): { label: string; count: number }[] {
  return benchmark.flowSteps.slice(1).map((step, i) => ({
    label: step.dropLabel ?? step.label,
    count: (c.flow[i] ?? 0) - (c.flow[i + 1] ?? 0),
  }));
}

export const site = {
  name: "Snyk VulnBump",
  shortName: "VulnBump",
  description:
    "Can an AI agent upgrade a vulnerable dependency without breaking the project? VulnBump compares Snyk's Evo Remediation Agent with Claude Code, with and without a Snyk scan, and with a non-agentic baseline, on 307 upgrades in 43 real repositories.",
  repository: "https://github.com/snyk-labs/snyk-vulnbump-website",
} as const;

export const navLinks: { label: string; href: string; external?: boolean }[] = [
  { label: "Home", href: "/" },
  { label: "Results", href: "/results" },
  { label: "Methodology", href: "/methodology" },
  ...(benchmark.links.github
    ? [{ label: "GitHub", href: benchmark.links.github, external: true }]
    : []),
];
