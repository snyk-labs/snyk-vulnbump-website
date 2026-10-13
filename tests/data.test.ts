import { describe, expect, it } from "vitest";
import raw from "../src/data/benchmark.json";
import { baselines, benchmark, configById, firstFailedGates, highlighted } from "../src/data";
import { benchmarkSchema } from "../src/data/schema";
import { breakdownsCsv, comparisonCsv, ecosystemsCsv } from "../src/lib/csv";
import {
  formatCompact,
  formatPercent,
  formatPp,
  formatRatio,
  formatUsd,
  formatWholePercent,
} from "../src/lib/format";
import { authorLine, listWords } from "../src/lib/words";

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

  // Paper section 5.1: macro PASS rates, bump first.
  it("matches the paper's per-repository (macro) PASS rates", () => {
    expect(formatPercent(benchmark.baseline.macro)).toBe("51.3%");
    expect(benchmark.configurations.map((c) => formatPercent(c.macro))).toEqual(["68.0%", "80.1%", "93.1%"]);
  });

  // Paper section 5.1: Evo passes 39 more than Claude Code + Snyk scan.
  it("keeps the paired comparisons consistent with the paper", () => {
    const shown = benchmark.paired.comparisons.map(
      (c) => `${c.a}>${c.b} ${c.aOnly}/${c.bOnly} ${formatPp(configById(c.a).macro, configById(c.b).macro)}`,
    );
    expect(shown).toEqual([
      "evo-remediation-agent>claude-code-snyk 46/7 +13.0 pp",
      "evo-remediation-agent>claude-code 96/2 +25.1 pp",
      "claude-code-snyk>claude-code 64/9 +12.1 pp",
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

  // The package manager bump in Tables 2 and 4 and Figures 4 to 6.
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
    // Dependencies, vulnerability, build, tests.
    expect(firstFailedGates(b).map((g) => g.count)).toEqual([54, 78, 16, 15]);
    expect(benchmark.rootCauses.groups.map((g) => g.counts[b.id])).toEqual([77, 54, 28, 4]);
    // Figure 5: patch, minor, major, minor (0.x); the text merges minor and 0.x (58%).
    expect(b.jumps.map((j) => formatWholePercent(j.passed / j.attempts))).toEqual(["67%", "59%", "25%", "33%"]);
    const minor = b.jumps.filter((j) => j.id.startsWith("minor"));
    expect(formatWholePercent(minor.reduce((t, j) => t + j.passed, 0) / minor.reduce((t, j) => t + j.attempts, 0))).toBe("58%");
    // Figure 6: fix difficulty, then dependency type.
    expect(b.breakdowns.upgradeSize!.map((c) => formatWholePercent(c.passRate))).toEqual(["28%", "39%", "17%"]);
    expect(b.breakdowns.dependency!.map((c) => formatWholePercent(c.passRate))).toEqual(["41%", "24%"]);
  });

  // Paper Table 3.
  it("matches the paper's split by what Snyk's advice alone solves", () => {
    const rows = benchmark.adviceSplit.agents.map((a) => [
      a.id,
      formatPercent(a.solvablePassed / benchmark.adviceSplit.solvable),
      a.regressions,
      formatPercent(a.otherPassed / benchmark.adviceSplit.other),
      a.gains,
    ]);
    expect(rows).toEqual([
      ["claude-code", "86.1%", 20, "36.2%", 59],
      ["claude-code-snyk", "95.8%", 6, "61.3%", 100],
      ["evo-remediation-agent", "99.3%", 1, "82.2%", 134],
    ]);
  });

  it("states the six reviewed findings, each linking to a results section", () => {
    expect(benchmark.findings.map((f) => f.title)).toEqual([
      "Build and tests alone can't separate the agents; checking the fix does",
      "An SCA scan is a key tool for agents fixing vulnerabilities",
      "Same model, same findings: the harness makes the difference",
      "Claude Code fails silently; Evo Remediation Agent fails visibly",
      "Major framework migrations remain hard for every agent",
      "Transitive vulnerabilities are harder to fix for every harness",
    ]);
    expect(benchmark.findings.map((f) => f.href)).toEqual([
      "/results#head-to-head",
      "/results#advice",
      "/results#paired",
      "/results#failures",
      "/results#jump",
      "/results#breakdown",
    ]);
  });

  // The leaderboard's "Targeted vulns fixed" column is the rescan gate, per package manager too.
  it("counts rescan-gate passes per package manager from the harness reports", () => {
    const shares = Object.fromEntries(
      benchmark.configurations.map((c) => [c.id, c.ecosystems.map((e) => formatPercent(e.vulnsFixed / e.attempts))]),
    );
    // Maven, Gradle, npm, Yarn, pip, Poetry.
    expect(shares).toEqual({
      "claude-code": ["52.8%", "57.6%", "87.7%", "88.9%", "94.4%", "42.9%"],
      "claude-code-snyk": ["74.5%", "89.4%", "93.0%", "100.0%", "100.0%", "71.4%"],
      "evo-remediation-agent": ["95.3%", "100.0%", "96.5%", "100.0%", "94.4%", "97.6%"],
    });
  });

  it("credits the paper's authors and affiliations", () => {
    expect(benchmark.paper.date).toBe("2026-10-12");
    expect(authorLine(benchmark.paper.authors)).toBe(
      "Gabija Pasiunaite, Ryan McMorrow, Brian Clark and Liran Tal (Snyk) and Luke Tu (Brown University and Snyk)",
    );
    expect(benchmark.citation?.authors).toEqual(benchmark.paper.authors.map((a) => a.name));
  });

  it("uses the paper's names", () => {
    expect(benchmark.configurations.map((c) => c.label)).toEqual([
      "Claude Code unaided",
      "Claude Code + Snyk scan",
      "Evo Remediation Agent",
    ]);
    expect(benchmark.baseline.label).toBe("Package manager bump");
  });

  // Paper Figure 5, and the per-package-manager macro rates behind section 5.1.
  it("matches the paper's version-jump figure and package-manager claim", () => {
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
    // "At or above both Claude Code agents in every package manager."
    const evo = configById("evo-remediation-agent").ecosystems;
    for (const other of baselines) {
      other.ecosystems.forEach((e, i) => expect(evo[i]!.macroPassRate).toBeGreaterThanOrEqual(e.macroPassRate));
    }
  });

  // Paper Figure 6: share fixed by passing upgrades, by fix difficulty and dependency type.
  it("matches the paper's transitive-vulnerability figure", () => {
    const shares = Object.fromEntries(
      benchmark.configurations.map((c) => [
        c.id,
        [...c.breakdowns.upgradeSize!.slice(0, 3), ...c.breakdowns.dependency!].map((x) => formatWholePercent(x.passRate)),
      ]),
    );
    // Patch, minor, major, direct, transitive.
    expect(shares).toEqual({
      "claude-code": ["37%", "45%", "30%", "62%", "28%"],
      "claude-code-snyk": ["67%", "65%", "55%", "71%", "59%"],
      "evo-remediation-agent": ["79%", "82%", "70%", "91%", "73%"],
    });
  });

  // Paper Figures 1 and 2 and section 3.4.
  it("matches the paper's dataset selection", () => {
    expect(benchmark.selection.funnel.map((f) => f.count)).toEqual([767, 508, 475, 199, 141, 99, 43]);
    expect(benchmark.selection.composition.medianTests).toBe(88);
    expect(benchmark.representativeness.dimensions.find((d) => d.id === "difficulty")!.benchmark).toEqual([34, 41, 24]);
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

  it("rejects per-package-manager rescan counts that miss the gate total", () => {
    const data = clone();
    data.configurations[0].ecosystems[2].vulnsFixed -= 1;
    expect(messages(data)).toContain("Ecosystem vulnsFixed sum to 194, expected 195");
  });

  it("rejects a breakdown that does not cover every vulnerability", () => {
    const data = clone();
    data.configurations[1].breakdowns.severity[0].n -= 1;
    expect(messages(data).some((m) => /"severity" covers/.test(m))).toBe(true);
  });

  it("rejects bump jumps on different upgrades than the agents'", () => {
    const data = clone();
    data.baseline.jumps[1].attempts -= 1;
    data.baseline.jumps[2].attempts += 1;
    expect(messages(data)).toContain('"minor" has 122 upgrades, the agents 123');
  });

  it("rejects a bump breakdown bucket the agents do not have", () => {
    const data = clone();
    data.baseline.breakdowns.dependency[0].n = 616;
    expect(messages(data)).toContain('"Direct" must match an agent bucket of the same size');
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
  });

  it("joins words and groups authors by affiliation", () => {
    expect(listWords(["a"])).toBe("a");
    expect(listWords(["a", "b", "c"])).toBe("a, b and c");
    expect(authorLine([{ name: "A", affiliations: ["X"] }, { name: "B", affiliations: ["X"] }])).toBe("A and B (X)");
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

  it("emits one breakdown row per category, the baseline's first", () => {
    const lines = breakdownsCsv(benchmark).trim().split("\n");
    const count = (b: Record<string, unknown[]>) => Object.values(b).reduce((m, cats) => m + cats.length, 0);
    const rows = benchmark.configurations.reduce((n, c) => n + count(c.breakdowns), count(benchmark.baseline.breakdowns));
    expect(lines).toHaveLength(rows + 1);
    expect(lines[1]).toBe("package-manager-bump,upgradeSize,Patch,713,,0.28");
  });
});
