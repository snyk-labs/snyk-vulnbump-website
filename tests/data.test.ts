import { describe, expect, it } from "vitest";
import raw from "../src/data/benchmark.json";
import { baselines, benchmark, configById, firstFailedGates, highlighted } from "../src/data";
import { benchmarkSchema } from "../src/data/schema";
import { breakdownsCsv, comparisonCsv, ecosystemsCsv } from "../src/lib/csv";
import {
  formatCompact,
  formatFraction,
  formatMacro,
  formatPercent,
  formatPp,
  formatPValue,
  formatRatio,
  formatSignedFraction,
  formatUsd,
  formatWholePercent,
} from "../src/lib/format";

const clone = () => structuredClone(raw) as Record<string, any>;
const messages = (data: unknown) =>
  benchmarkSchema.safeParse(data).error?.issues.map((i) => i.message) ?? [];

describe("benchmark dataset", () => {
  it("validates against the schema", () => {
    expect(messages(raw)).toEqual([]);
  });

  it("matches the harness reports' headline figures", () => {
    const byId = Object.fromEntries(benchmark.configurations.map((c) => [c.id, c]));
    expect(formatRatio(byId["evo-remediation-agent"]!.passed, byId["evo-remediation-agent"]!.attempts)).toBe("277 of 307");
    expect(formatPercent(byId["evo-remediation-agent"]!.values.allGates!)).toBe("90.2%");
    expect(formatPercent(byId["claude-code-snyk"]!.values.allGates!)).toBe("77.5%");
    expect(formatPercent(byId["claude-code"]!.values.allGates!)).toBe("59.6%");
  });

  // Paper Table 2, row by row, in the paper's order.
  it("displays every head-to-head value exactly as the paper's Table 2 states it", () => {
    expect(benchmark.metrics.map((m) => m.key)).toEqual([
      "depsResolve",
      "vulnsFixed",
      "cleanBuild",
      "testsPass",
      "projectWorks",
      "allGates",
      "instancesFixed",
    ]);
    const expected: Record<string, string[]> = {
      "claude-code": ["95.4%", "63.5%", "98.4%", "98.7%", "93.8%", "59.6%", "72.7%"],
      "claude-code-snyk": ["94.8%", "83.7%", "98.0%", "99.0%", "92.8%", "77.5%", "83.1%"],
      "evo-remediation-agent": ["100.0%", "97.1%", "96.7%", "95.4%", "92.8%", "90.2%", "95.9%"],
    };
    for (const c of benchmark.configurations) {
      const shown = benchmark.metrics.map((m) => formatPercent(c.values[m.key]!));
      expect(shown).toEqual(expected[c.id]);
    }
    expect(benchmark.configurations.map((c) => formatRatio(c.vulnsCleared, c.vulnsFixable))).toEqual([
      "1,503 of 2,066",
      "1,716 of 2,066",
      "1,982 of 2,066",
    ]);
  });

  it("keeps every gate rate consistent with the failure counts", () => {
    for (const c of benchmark.configurations) {
      const { reasons } = c.failures;
      expect(c.gates.depsResolve).toBe(c.attempts - reasons.depsUnresolved!);
      expect(c.gates.vulnsFixed).toBe(c.attempts - reasons.vulnNotCleared!);
      expect(c.gates.cleanBuild).toBe(c.attempts - reasons.buildBroken!);
      expect(c.gates.testsPass).toBe(c.attempts - reasons.testsRegressed!);
    }
  });

  it("scores every configuration on the same upgrades", () => {
    for (const c of benchmark.configurations) {
      expect([c.attempts, c.repos, c.vulnsFixable]).toEqual([307, 43, 2066]);
    }
  });

  // Paper Table 3.
  it("matches the paper's repository-level results", () => {
    const rows = benchmark.configurations.map((c) => [
      formatMacro(c.macro),
      `${c.reposAllPass} / ${c.reposNonePass}`,
      formatMacro(c.macroFixed),
      c.quality.remaining.slice(1).join(" / "),
    ]);
    expect(rows).toEqual([
      ["0.680 [0.582, 0.770]", "15 / 3", "0.807 [0.722, 0.882]", "282 / 223 / 58"],
      ["0.801 [0.710, 0.879]", "22 / 2", "0.901 [0.841, 0.951]", "143 / 167 / 40"],
      ["0.931 [0.881, 0.971]", "32 / 0", "0.976 [0.952, 0.994]", "35 / 35 / 14"],
    ]);
  });

  // Paper section 5.2.
  it("matches the paper's paired comparisons", () => {
    const shown = benchmark.paired.comparisons.map(
      (c) =>
        `${c.a}>${c.b} ${c.aOnly}/${c.bOnly} p=${formatPValue(c.p)} ${formatSignedFraction(c.macroDiff)} [${formatFraction(c.ci[0])}, ${formatFraction(c.ci[1])}]`,
    );
    expect(shown).toEqual([
      "evo-remediation-agent>claude-code-snyk 46/7 p=4.0 × 10⁻⁸ +0.130 [0.062, 0.214]",
      "evo-remediation-agent>claude-code 96/2 p=3.1 × 10⁻²⁶ +0.251 [0.170, 0.341]",
      "claude-code-snyk>claude-code 64/9 p=2.4 × 10⁻¹¹ +0.121 [0.033, 0.203]",
    ]);
    const count = (ids: string[]) =>
      benchmark.paired.agreement.find((a) => a.passedBy.length === ids.length && ids.every((id) => a.passedBy.includes(id)))!.count;
    expect(count(["claude-code", "claude-code-snyk", "evo-remediation-agent"])).toBe(172);
    expect(count([])).toBe(23);
    expect([count(["evo-remediation-agent"]), count(["claude-code-snyk"]), count(["claude-code"])]).toEqual([37, 5, 0]);
  });

  // Paper Figure 4 and Table 4.
  it("matches the paper's first failed gates and root causes", () => {
    const gates = Object.fromEntries(
      benchmark.configurations.map((c) => [c.id, firstFailedGates(c).map((g) => g.count)]),
    );
    // Dependencies, vulnerability, build, tests.
    expect(gates).toEqual({
      "claude-code": [14, 107, 3, 0],
      "claude-code-snyk": [16, 48, 3, 2],
      "evo-remediation-agent": [0, 9, 9, 12],
    });
    const groups = benchmark.rootCauses.groups.map((g) => [g.counts["claude-code"], g.counts["claude-code-snyk"], g.counts["evo-remediation-agent"]]);
    expect(groups).toEqual([
      [92, 40, 8],
      [30, 25, 7],
      [2, 4, 15],
      [0, 0, 0],
    ]);
  });

  // Draft v2: the package manager bump in Tables 2, 3 and 5 and Figure 4.
  it("matches the paper's package manager bump column", () => {
    const b = benchmark.baseline;
    expect(benchmark.metrics.map((m) => formatPercent(b.values[m.key]!))).toEqual([
      "82.4%",
      "62.2%",
      "87.0%",
      "80.5%",
      "64.2%",
      "46.9%",
      "56.5%",
    ]);
    expect(formatRatio(b.passed, b.attempts)).toBe("144 of 307");
    expect(formatRatio(b.vulnsCleared, b.vulnsFixable)).toBe("1,168 of 2,066");
    expect([formatMacro(b.macro), `${b.reposAllPass} / ${b.reposNonePass}`, formatMacro(b.macroFixed)]).toEqual([
      "0.513 [0.397, 0.623]",
      "10 / 10",
      "0.725 [0.611, 0.832]",
    ]);
    expect(b.remaining.slice(1)).toEqual([469, 341, 88]);
    // Dependencies, vulnerability, build, tests.
    expect(firstFailedGates(b).map((g) => g.count)).toEqual([54, 78, 16, 15]);
    expect(benchmark.rootCauses.groups.map((g) => g.counts[b.id])).toEqual([77, 54, 28, 4]);
    expect(b.jumps.map((j) => formatWholePercent(j.passed / j.attempts))).toEqual(["67%", "58%", "25%"]);
  });

  // Draft v2, Table 4.
  it("matches the paper's split by what Snyk's advice alone solves", () => {
    const rows = benchmark.adviceSplit.agents.map((a) => [
      a.id,
      formatPercent(a.solvablePassed / benchmark.adviceSplit.solvable),
      formatMacro(a.solvableMacro),
      formatPercent(a.otherPassed / benchmark.adviceSplit.other),
      formatMacro(a.otherMacro),
      `${a.regressions}/${a.valueAdd}/${a.valueAddTestEdits}/${a.valueAddManagedPins}`,
      formatPValue(a.p),
    ]);
    expect(rows).toEqual([
      ["claude-code", "86.1%", "0.918 [0.859, 0.968]", "36.2%", "0.413 [0.288, 0.543]", "20/59/11/20", "1.3 × 10⁻⁵"],
      ["claude-code-snyk", "95.8%", "0.986 [0.968, 1.000]", "61.3%", "0.647 [0.518, 0.768]", "6/100/17/42", "4.5 × 10⁻²³"],
      ["evo-remediation-agent", "99.3%", "0.997 [0.990, 1.000]", "82.2%", "0.870 [0.791, 0.940]", "1/134/35/47", "6.2 × 10⁻³⁹"],
    ]);
  });

  it("uses the paper's names", () => {
    expect(benchmark.configurations.map((c) => c.label)).toEqual([
      "Claude Code unaided",
      "Claude Code + Snyk scan",
      "Evo Remediation Agent",
    ]);
    expect(benchmark.baseline.label).toBe("Package manager bump");
  });

  // Paper Figures 5 and 6.
  it("matches the paper's version-jump and package-manager figures", () => {
    const jumps = Object.fromEntries(
      benchmark.configurations.map((c) => [c.id, c.jumps.map((j) => formatWholePercent(j.passed / j.attempts))]),
    );
    // Patch, minor, major, minor (0.x).
    expect(jumps).toEqual({
      "claude-code": ["77%", "67%", "42%", "67%"],
      "claude-code-snyk": ["98%", "86%", "61%", "44%"],
      "evo-remediation-agent": ["96%", "98%", "81%", "78%"],
    });
    const macro = Object.fromEntries(
      benchmark.configurations.map((c) => [c.id, c.ecosystems.map((e) => Math.round(e.macroPassRate * 100 + 1e-9))]),
    );
    // Maven, Gradle, npm, Yarn, pip, Poetry.
    expect(benchmark.ecosystems.map((e) => e.id)).toEqual(["maven", "gradle", "npm", "yarn", "pip", "poetry"]);
    expect(macro).toEqual({
      "claude-code": [54, 75, 86, 87, 93, 49],
      "claude-code-snyk": [75, 93, 78, 100, 97, 72],
      "evo-remediation-agent": [89, 100, 94, 100, 97, 98],
    });
  });

  // Paper Figure 1.
  it("matches the paper's dataset selection", () => {
    expect(benchmark.selection.funnel.map((f) => f.count)).toEqual([767, 508, 475, 199, 141, 99, 43]);
    expect(benchmark.selection.sources.map((s) => s.count)).toEqual([274, 280, 133, 46, 34]);
    expect(configById("evo-remediation-agent").ecosystems.map((e) => e.repos)).toEqual([18, 3, 11, 3, 3, 5]);
  });

  it("highlights exactly one configuration", () => {
    expect(highlighted.id).toBe("evo-remediation-agent");
    expect(baselines.map((c) => c.id)).toEqual(["claude-code", "claude-code-snyk"]);
  });

  it("rejects a gate flow that grows", () => {
    const data = clone();
    data.configurations[0].flow[3] = 999;
    expect(messages(data)).toContain("Flow counts must not increase");
  });

  it("rejects ecosystem rows that do not add up", () => {
    const data = clone();
    data.configurations[2].ecosystems[0].passed += 1;
    expect(messages(data).some((m) => /passed sum/.test(m))).toBe(true);
  });

  it("rejects a breakdown that does not cover every vulnerability", () => {
    const data = clone();
    data.configurations[1].breakdowns.severity[0].n -= 1;
    expect(messages(data).some((m) => /"severity" covers/.test(m))).toBe(true);
  });

  it("rejects a macro rate outside its interval", () => {
    const data = clone();
    data.configurations[0].macro.rate = 0.99;
    expect(messages(data)).toContain("Macro rate must lie inside its confidence interval");
  });

  it("rejects a selection funnel that does not end at the repositories run", () => {
    const data = clone();
    data.selection.funnel.at(-1).count = 42;
    expect(messages(data).some((m) => /Expected 42 repositories/.test(m))).toBe(true);
  });

  it("rejects a quality signal the configurations do not record", () => {
    const data = clone();
    data.qualitySignals.push({ key: "madeUp", label: "Made up", description: "Nothing.", attention: false });
    expect(messages(data).some((m) => /missing quality signal "madeUp"/.test(m))).toBe(true);
  });

  it("rejects paired counts that disagree with the agreement pattern", () => {
    const data = clone();
    data.paired.comparisons[0].aOnly = 45;
    expect(messages(data).some((m) => /Discordant counts disagree/.test(m))).toBe(true);
  });

  it("rejects root causes that do not cover every failure", () => {
    const data = clone();
    data.rootCauses.groups[0].causes[0].counts["evo-remediation-agent"] = 2;
    expect(messages(data).some((m) => /causes for "evo-remediation-agent" sum to/.test(m))).toBe(true);
  });

  it("rejects an advice split that does not add up to an agent's PASSes", () => {
    const data = clone();
    data.adviceSplit.agents[0].otherPassed = 60;
    expect(messages(data).some((m) => /split sums to 184, expected 183/.test(m))).toBe(true);
  });

  it("rejects a baseline rate that disagrees with its counts", () => {
    const data = clone();
    data.baseline.gates.cleanBuild = 268;
    expect(messages(data)).toContain('Baseline "cleanBuild" disagrees with its counts');
  });

  it("rejects a rate that disagrees with its counts", () => {
    const data = clone();
    data.configurations[0].gates.vulnsFixed = 196;
    expect(messages(data)).toContain('"vulnsFixed" disagrees with its counts');
  });

  it("requires exactly one highlighted configuration", () => {
    const data = clone();
    data.configurations[0].highlight = true;
    expect(messages(data)).toContain("Exactly one configuration must be highlighted");
  });
});

describe("formatting", () => {
  it("formats rates, money and differences", () => {
    expect(formatPercent(0.9007)).toBe("90.1%");
    expect(formatWholePercent(0.7)).toBe("70%");
    expect(formatUsd(2.07)).toBe("$2.07");
    expect(formatUsd(0.0848)).toBe("$0.085");
    expect(formatCompact(976194)).toBe("976.2K");
    expect(formatPp(0.9007, 0.596)).toBe("+30.5 pp");
    expect(formatPValue(4.0e-8)).toBe("4.0 × 10⁻⁸");
    expect(formatPValue(3.1e-26)).toBe("3.1 × 10⁻²⁶");
    expect(formatMacro({ rate: 0.68, ci: [0.582, 0.77] })).toBe("0.680 [0.582, 0.770]");
  });
});

describe("CSV downloads", () => {
  it("emits one comparison row per configuration", () => {
    const lines = comparisonCsv(benchmark).trim().split("\n");
    // Header, the non-agent baseline, then one row per agent.
    expect(lines).toHaveLength(benchmark.configurations.length + 2);
    expect(lines[0]).toContain("allGates");
  });

  it("emits one ecosystem row per configuration × ecosystem", () => {
    const lines = ecosystemsCsv(benchmark).trim().split("\n");
    const rows = benchmark.configurations.reduce((n, c) => n + c.ecosystems.length, 0);
    expect(lines).toHaveLength(rows + 1);
  });

  it("emits one breakdown row per category", () => {
    const lines = breakdownsCsv(benchmark).trim().split("\n");
    const rows = benchmark.configurations.reduce(
      (n, c) => n + Object.values(c.breakdowns).reduce((m, cats) => m + cats.length, 0),
      0,
    );
    expect(lines).toHaveLength(rows + 1);
  });
});
