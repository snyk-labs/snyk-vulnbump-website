import type { Benchmark } from "../data/schema";

function cell(value: string | number): string {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function toCsv(rows: (string | number)[][]): string {
  return `${rows.map((row) => row.map(cell).join(",")).join("\n")}\n`;
}

/** One row per configuration: counts, gate rates, and gate flow. */
export function comparisonCsv(data: Benchmark): string {
  const flowKeys = data.flowSteps.map((s) => `flow_${s.label.toLowerCase().replaceAll(" ", "_")}`);
  const header = [
    "configuration_id",
    "label",
    "attempts",
    "passed",
    "project_still_works",
    "vulns_fixable",
    "vulns_cleared",
    ...data.metrics.map((m) => m.key),
    "macro_pass_rate",
    ...flowKeys,
  ];
  const rows = data.configurations.map((c) => [
    c.id,
    c.label,
    c.attempts,
    c.passed,
    c.green,
    c.vulnsFixable,
    c.vulnsCleared,
    ...data.metrics.map((m) => c.values[m.key] ?? ""),
    c.macro,
    ...c.flow,
  ]);
  const b = data.baseline;
  const baselineRow = [
    b.id,
    b.label,
    b.attempts,
    b.passed,
    b.green,
    b.vulnsFixable,
    b.vulnsCleared,
    ...data.metrics.map((m) => b.values[m.key] ?? ""),
    b.macro,
    ...b.flow,
  ];
  return toCsv([header, baselineRow, ...rows]);
}

/** One row per configuration × ecosystem. */
export function ecosystemsCsv(data: Benchmark): string {
  const header = [
    "configuration_id",
    "ecosystem",
    "repos",
    "attempts",
    "deps_resolve_rate",
    "vulns_cleared",
    "vulns_fixable",
    "build_pass_rate",
    "tests_pass_rate",
    "passed",
    "macro_pass_rate",
  ];
  const rows = data.configurations.flatMap((c) =>
    c.ecosystems.map((e) => [
      c.id,
      e.id,
      e.repos,
      e.attempts,
      e.depsResolveRate,
      e.vulnsCleared,
      e.vulnsFixable,
      e.buildPassRate,
      e.testsPassRate,
      e.passed,
      e.macroPassRate,
    ]),
  );
  return toCsv([header, ...rows]);
}

/**
 * One row per configuration × dimension × category (per-vulnerability rates),
 * the baseline first. It has only the dimensions and pass rates the paper
 * reports, so its fix rate is blank.
 */
export function breakdownsCsv(data: Benchmark): string {
  const header = ["configuration_id", "dimension", "category", "n", "fix_rate", "pass_rate"];
  const b = data.baseline;
  const baselineRows = Object.entries(b.breakdowns).flatMap(([dimension, categories]) =>
    categories.map((cat) => [b.id, dimension, cat.label, cat.n, "", cat.passRate]),
  );
  const rows = data.configurations.flatMap((c) =>
    Object.entries(c.breakdowns).flatMap(([dimension, categories]) =>
      categories.map((cat) => [c.id, dimension, cat.label, cat.n, cat.fixRate, cat.passRate]),
    ),
  );
  return toCsv([header, ...baselineRows, ...rows]);
}
