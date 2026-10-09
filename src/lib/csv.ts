import type { Benchmark } from "../data/schema";

function cell(value: string | number): string {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function toCsv(rows: (string | number)[][]): string {
  return `${rows.map((row) => row.map(cell).join(",")).join("\n")}\n`;
}

/** One row per configuration: counts, gate rates, gate flow, cost and latency. */
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
    "macro_pass_ci_low",
    "macro_pass_ci_high",
    "macro_fix_rate",
    "macro_fix_ci_low",
    "macro_fix_ci_high",
    "repos_all_pass",
    "repos_none_pass",
    ...flowKeys,
    "latency_p50_s",
    "latency_mean_s",
    "cost_mean_usd",
    "cost_p50_usd",
    "cost_method",
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
    c.macro.rate,
    c.macro.ci[0],
    c.macro.ci[1],
    c.macroFixed.rate,
    c.macroFixed.ci[0],
    c.macroFixed.ci[1],
    c.reposAllPass,
    c.reposNonePass,
    ...c.flow,
    c.latencySeconds.p50,
    c.latencySeconds.mean,
    c.cost.perAttempt.mean,
    c.cost.perAttempt.p50,
    c.cost.method,
  ]);
  // The non-agent baseline has no model, so no cost or latency.
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
    b.macro.rate,
    b.macro.ci[0],
    b.macro.ci[1],
    b.macroFixed.rate,
    b.macroFixed.ci[0],
    b.macroFixed.ci[1],
    b.reposAllPass,
    b.reposNonePass,
    ...b.flow,
    "",
    "",
    "",
    "",
    "not applicable",
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

/** One row per configuration × dimension × category (per-vulnerability rates). */
export function breakdownsCsv(data: Benchmark): string {
  const header = ["configuration_id", "dimension", "category", "n", "fix_rate", "pass_rate"];
  const rows = data.configurations.flatMap((c) =>
    Object.entries(c.breakdowns).flatMap(([dimension, categories]) =>
      categories.map((cat) => [c.id, dimension, cat.label, cat.n, cat.fixRate, cat.passRate]),
    ),
  );
  return toCsv([header, ...rows]);
}
