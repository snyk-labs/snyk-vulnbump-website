import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GateFunnel } from "../src/components/charts/GateFunnel";
import { type BoardAgent, Leaderboard, leaderboardRows } from "../src/components/charts/Leaderboard";
import { VulnBreakdown } from "../src/components/charts/VulnBreakdown";
import { benchmark, funnelLanes, gateDetails } from "../src/data";
import { displayOrder, passOpacity } from "../src/lib/colors";
import { formatPercent } from "../src/lib/format";

const { configurations, flowSteps, dimensions, release, ecosystems, baseline } = benchmark;
const version = release.datasetVersion;
const op = passOpacity(configurations);

const agents: BoardAgent[] = displayOrder(configurations).map((c) => ({
  id: c.id,
  label: c.label,
  subtitle: c.subtitle,
  highlight: c.highlight,
  attempts: c.attempts,
  overall: {
    pass: c.values.allGates!,
    fixed: c.values.vulnsFixed!,
    deps: c.values.depsResolve!,
    build: c.values.cleanBuild!,
    tests: c.values.testsPass!,
  },
  ecosystems: c.ecosystems,
}));

// Server render is what no-JS visitors and crawlers receive, so every chart
// must ship its labels and exact-value table in the initial HTML.
describe("chart server render", () => {
  it("GateFunnel draws one lane per harness, highlighted agent first and baseline last", () => {
    const html = renderToString(
      <GateFunnel lanes={funnelLanes()} steps={flowSteps} gates={gateDetails} datasetVersion={version} />,
    );
    for (const step of flowSteps) expect(html).toContain(step.label);
    const order = ["Evo Remediation Agent", "Claude Code + Snyk scan", "Claude Code unaided", "Package manager bump"];
    const positions = order.map((label) => html.indexOf(label));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    // Exact values table and the default selected gate (Gate 2, the rescan).
    expect(html).toContain("277 (90.2%)");
    expect(html).toContain("144 (46.9%)");
    expect(html).toContain("Gate 2 · Targeted vulns fixed");
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain("gatelane--baseline");
  });

  it("VulnBreakdown shows every agent and the baseline for the default dimension", () => {
    const html = renderToString(
      <VulnBreakdown
        series={[
          ...displayOrder(configurations).map(({ id, label, highlight, breakdowns }) => ({
            id,
            label,
            highlight,
            op: op[id]!,
            breakdowns,
          })),
          { id: baseline.id, label: baseline.label, highlight: false, op: "1", baseline: true, breakdowns: baseline.breakdowns },
        ]}
        dimensions={dimensions}
        datasetVersion={version}
      />,
    );
    for (const c of configurations) expect(html).toContain(c.label);
    // Default dimension is fix difficulty (paper Figure 6a). Patch fix / pass
    // per vulnerability: Evo Remediation Agent, Claude Code + Snyk scan, unaided.
    expect(html).toContain("96% / 79% (713)");
    expect(html).toContain("96% / 67% (713)");
    expect(html).toContain("89% / 37% (713)");
    // The bump has pass rates only, and no bucket for unclassified vulnerabilities.
    expect(html).toContain("— / 28% (713)");
    expect(html).toContain("passtrack passtrack--baseline");
    expect(html.match(/passtrack--baseline/g)).toHaveLength(3);
  });

  it("Leaderboard ranks the agents and lists the baseline unranked", () => {
    const html = renderToString(
      <Leaderboard
        agents={agents}
        baseline={{
          id: baseline.id,
          label: baseline.label,
          subtitle: baseline.subtitle,
          attempts: baseline.attempts,
          overall: {
            pass: baseline.values.allGates!,
            fixed: baseline.values.vulnsFixed!,
            deps: baseline.values.depsResolve!,
            build: baseline.values.cleanBuild!,
            tests: baseline.values.testsPass!,
          },
        }}
        ecosystems={ecosystems}
        eyebrow="Leaderboard"
        title="Same model, three agents"
        titleId="t"
      />,
    );
    expect(html).toContain("Same model, three agents");
    expect(html).toContain('aria-sort="descending"');
    expect(html).toContain("Not ranked");
    // The rescan gate, for the agents and the baseline (62.2%, not 56.5% of instances).
    expect(html).toContain("Targeted vulns fixed");
    expect(html).toContain("97.1%");
    expect(html).toContain("62.2%");
    expect(html).not.toContain("95.9%");
  });
});

describe("leaderboard ranking", () => {
  it("sorts by PASS descending and marks the best per column", () => {
    const { rows, best } = leaderboardRows(agents, "all", "pass", -1);
    expect(rows.map((r) => r.agent.id)).toEqual(["evo-remediation-agent", "claude-code-snyk", "claude-code"]);
    // Claude Code unaided keeps the build green most often.
    expect(best.build).toBe(configurations.find((c) => c.id === "claude-code")!.values.cleanBuild);
  });

  it("recomputes rates within one ecosystem", () => {
    const { rows } = leaderboardRows(agents, "maven", "pass", -1);
    const evo = rows.find((r) => r.agent.id === "evo-remediation-agent")!;
    expect(evo.attempts).toBe(106);
    expect(evo.rates.pass).toBeCloseTo(88 / 106, 6);
    // The rescan gate (upgrades), not the share of vulnerability instances.
    expect(evo.rates.fixed).toBeCloseTo(101 / 106, 6);
  });

  it("shows the rescan gate in the targeted-vulnerabilities column", () => {
    const { rows } = leaderboardRows(agents, "all", "fixed", -1);
    expect(rows.map((r) => formatPercent(r.rates.fixed))).toEqual(["97.1%", "83.7%", "63.5%"]);
  });

  it("toggles to ascending", () => {
    const { rows } = leaderboardRows(agents, "all", "pass", 1);
    expect(rows[0]!.agent.id).toBe("claude-code");
  });
});
