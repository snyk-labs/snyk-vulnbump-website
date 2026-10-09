import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GateFunnel, spreadLabels } from "../src/components/charts/GateFunnel";
import { VulnBreakdown } from "../src/components/charts/VulnBreakdown";
import { benchmark } from "../src/data";

const { configurations, flowSteps, dimensions, release, baseline } = benchmark;
const version = release.datasetVersion;

// Server render is what no-JS visitors and crawlers receive, so every chart
// must ship its labels and exact-value table in the initial HTML.
describe("chart server render", () => {
  it("GateFunnel labels every gate and every configuration's outcome", () => {
    const html = renderToString(
      <GateFunnel
        series={configurations.map(({ id, label, highlight, flow }) => ({ id, label, highlight, flow }))}
        steps={flowSteps}
        datasetVersion={version}
      />,
    );
    for (const step of flowSteps) expect(html).toContain(step.label);
    for (const c of configurations) expect(html).toContain(c.label);
    expect(html).toContain("277 (90.2%)");
    expect(html).toContain("238 (77.5%)");
    expect(html).toContain("183 (59.6%)");
  });

  it("GateFunnel draws the non-agent baseline dashed", () => {
    const html = renderToString(
      <GateFunnel
        series={[
          { id: baseline.id, label: baseline.label, highlight: false, baseline: true, flow: baseline.flow },
          ...configurations.map(({ id, label, highlight, flow }) => ({ id, label, highlight, flow })),
        ]}
        steps={flowSteps}
        datasetVersion={version}
      />,
    );
    expect(html).toContain("Package manager bump");
    expect(html).toContain("144 (46.9%)");
    expect(html).toContain('stroke-dasharray="6 5"');
  });

  it("VulnBreakdown shows every configuration for the default dimension", () => {
    const html = renderToString(
      <VulnBreakdown
        series={configurations.map(({ id, label, highlight, breakdowns }) => ({ id, label, highlight, breakdowns }))}
        dimensions={dimensions}
        datasetVersion={version}
      />,
    );
    for (const c of configurations) expect(html).toContain(c.label);
    // Default dimension is fix difficulty (paper Figure 7a). Patch fix / pass
    // per vulnerability: Evo Remediation Agent, Claude Code + Snyk scan, unaided.
    expect(html).toContain("96% / 79% (713)");
    expect(html).toContain("96% / 67% (713)");
    expect(html).toContain("89% / 37% (713)");
  });
});

describe("gate funnel end labels", () => {
  it("spreads colliding labels to the minimum gap without reordering", () => {
    const ys = spreadLabels([100, 104, 300, 102], 16, 0, 400);
    const sorted = [...ys].sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i]! - sorted[i - 1]!).toBeGreaterThanOrEqual(16);
    }
    expect(ys[0]).toBeLessThan(ys[3]!);
    expect(ys[3]).toBeLessThan(ys[1]!);
    expect(ys[2]).toBe(300);
  });

  it("pushes labels back inside the plot when they overflow the bottom", () => {
    const ys = spreadLabels([390, 395, 398], 16, 0, 400);
    expect(Math.max(...ys)).toBeLessThanOrEqual(400);
  });
});
