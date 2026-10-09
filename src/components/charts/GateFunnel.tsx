import { useState } from "react";
import type { FlowStep } from "../../data/schema";
import { BASELINE_COLOR, configColors } from "../../lib/colors";
import { formatInteger, formatPercent, formatWholePercent } from "../../lib/format";
import { indexLabel } from "../../lib/words";
import { useElementWidth } from "./useElementWidth";

export interface FunnelSeries {
  id: string;
  label: string;
  highlight: boolean;
  /** The non-agent baseline: drawn dashed, with hollow markers. */
  baseline?: boolean;
  /** Attempts surviving each step, aligned with `steps`. */
  flow: number[];
}

interface GateFunnelProps {
  series: FunnelSeries[];
  steps: FlowStep[];
  datasetVersion: string;
}

const MARKER = 4; // r >= 4 per mark spec
const LABEL_GAP = 17; // minimum vertical distance between end labels
const STAGE_LINE = 13;

/** Greedy word wrap for stage headings (SVG text does not wrap). */
/** Approximate advance of one stage-label character (11px mono, 0.1em tracking). */
const STAGE_CHAR = 7.8;

/**
 * Whether spelled-out stage labels fit between their neighbours: the first is
 * start-anchored, the last end-anchored, and the rest centred on their stage.
 */
function stageLabelsFit(lines: string[][], innerW: number): boolean {
  const n = lines.length;
  if (n < 2) return true;
  const widths = lines.map((l) => Math.max(...l.map((line) => line.length)) * STAGE_CHAR);
  const spacing = innerW / (n - 1);
  const right = (i: number) => (i === 0 ? widths[i]! : i === n - 1 ? 0 : widths[i]! / 2);
  const left = (i: number) => (i === n - 1 ? widths[i]! : widths[i]! / 2);
  for (let i = 0; i < n - 1; i++) {
    if (right(i) + left(i + 1) + 10 > spacing) return false;
  }
  return true;
}

function wrap(text: string, max: number): string[] {
  const lines: string[] = [];
  for (const word of text.split(" ")) {
    const last = lines[lines.length - 1];
    if (last !== undefined && `${last} ${word}`.length <= max) {
      lines[lines.length - 1] = `${last} ${word}`;
    } else {
      lines.push(word);
    }
  }
  return lines;
}

/** Spread end labels apart vertically, keeping order; returns new y per index. */
export function spreadLabels(ys: number[], gap: number, min: number, max: number): number[] {
  const order = ys.map((y, i) => ({ y, i })).sort((a, b) => a.y - b.y);
  const placed = order.map((o) => o.y);
  for (let k = 1; k < placed.length; k++) {
    placed[k] = Math.max(placed[k]!, placed[k - 1]! + gap);
  }
  const last = placed.length - 1;
  if (last >= 0 && placed[last]! > max) {
    placed[last] = max;
    for (let k = last - 1; k >= 0; k--) {
      placed[k] = Math.min(placed[k]!, placed[k + 1]! - gap);
    }
  }
  const result = new Array<number>(ys.length);
  order.forEach((o, k) => {
    result[o.i] = Math.max(min, placed[k]!);
  });
  return result;
}

/**
 * The shipping gates: each configuration's share of attempts that survives
 * each successive gate (vulnerability closed → still builds → tests pass).
 * One line per configuration; the highlighted one is drawn in Hot Pink and
 * the rest muted. Keys below the plot are the keyboard path.
 */
export function GateFunnel({ series: input, steps: flowSteps, datasetVersion }: GateFunnelProps) {
  const [plotRef, width] = useElementWidth<HTMLDivElement>(720);
  const [activeId, setActiveId] = useState<string | null>(null);

  const colors = {
    ...configColors(input.filter((c) => !c.baseline)),
    ...Object.fromEntries(input.filter((c) => c.baseline).map((c) => [c.id, BASELINE_COLOR])),
  };
  const series = input.map((config) => {
    const total = config.flow[0] ?? 0;
    const steps = config.flow.map((count, i) => ({
      label: flowSteps[i]?.label ?? "",
      count,
      share: total > 0 ? count / total : 0,
      dropped: i > 0 ? (config.flow[i - 1] ?? count) - count : 0,
    }));
    return { config, steps };
  });
  const stageLabels = flowSteps.map((s) => s.label);

  // End labels read "80.8%  Label": reserve room for the longest one.
  const longestLabel = Math.max(...input.map((c) => c.label.length));
  const wideLines = stageLabels.map((l) => wrap(l, 16));
  // Plots too narrow for the spelled-out stage labels (or where neighbours
  // would collide) number the gates on the axis and spell them out in a key.
  const narrow = width < 560 || !stageLabelsFit(wideLines, width - 44 - Math.min(300, 76 + longestLabel * 7));
  const stageLines = narrow
    ? stageLabels.map((_, i) => [i === 0 ? "Start" : indexLabel(i - 1)])
    : wideLines;
  const headLines = Math.max(...stageLines.map((l) => l.length));
  const margin = {
    top: 14 + headLines * STAGE_LINE,
    right: narrow ? 14 : Math.min(300, 76 + longestLabel * 7),
    bottom: 12,
    left: 44,
  };
  const height = narrow ? 300 : 380;
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;
  const sx = (i: number) =>
    margin.left + (stageLabels.length > 1 ? (i / (stageLabels.length - 1)) * innerW : 0);
  const sy = (share: number) => margin.top + (1 - share) * innerH;
  const lastIndex = stageLabels.length - 1;

  const highlightId = series.find((s) => s.config.highlight)?.config.id;
  const focusId = activeId ?? highlightId ?? series[0]?.config.id;
  const focus = series.find((s) => s.config.id === focusId);

  const color = (config: FunnelSeries) =>
    !config.highlight && config.id === activeId ? "#ffffff" : colors[config.id]!;

  // Draw muted first, then highlighted, then the active line on top.
  const drawOrder = [...series].sort((a, b) => {
    const rank = (s: (typeof series)[number]) =>
      s.config.id === activeId ? 2 : s.config.highlight ? 1 : 0;
    return rank(a) - rank(b);
  });

  const endYs = spreadLabels(
    series.map((s) => sy(s.steps[lastIndex]?.share ?? 0)),
    LABEL_GAP,
    margin.top,
    margin.top + innerH,
  );

  const summary = series
    .map((s) => `${s.config.label}: ${formatPercent(s.steps[lastIndex]?.share ?? 0)} reach "${stageLabels[lastIndex]}"`)
    .join("; ");
  const yTicks = [0, 0.25, 0.5, 0.75, 1];

  return (
    <figure className="chart">
      {narrow && (
        <ol className="gates__stages" aria-hidden="true">
          {stageLabels.slice(1).map((label, i) => (
            <li key={label}>
              <span className="metric">{indexLabel(i)}</span> {label}
            </li>
          ))}
        </ol>
      )}
      <div className="chart__plot">
        <div ref={plotRef}>
          <svg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            role="img"
            aria-label={`Share of attempts that clear each gate. ${summary}.`}
            onMouseLeave={() => setActiveId(null)}
          >
            {yTicks.map((t) => (
              <g key={t} aria-hidden="true">
                <line
                  className="chart-grid"
                  x1={margin.left}
                  x2={margin.left + innerW}
                  y1={sy(t)}
                  y2={sy(t)}
                />
                <text
                  className="chart-tick"
                  x={margin.left - 10}
                  y={sy(t)}
                  textAnchor="end"
                  dominantBaseline="middle"
                >
                  {formatWholePercent(t)}
                </text>
              </g>
            ))}

            {stageLines.map((lines, i) => (
              <g key={stageLabels[i]} aria-hidden="true">
                <line
                  className="chart-axis"
                  x1={sx(i)}
                  x2={sx(i)}
                  y1={margin.top}
                  y2={margin.top + innerH}
                />
                <text
                  className="chart-stage"
                  x={sx(i)}
                  y={12}
                  textAnchor={i === 0 ? "start" : i === lastIndex ? "end" : "middle"}
                >
                  {lines.map((line, k) => (
                    <tspan key={line} x={sx(i)} dy={k === 0 ? 0 : STAGE_LINE}>
                      {line}
                    </tspan>
                  ))}
                </text>
              </g>
            ))}

            {drawOrder.map(({ config, steps }) => {
              const d = steps
                .map((s, i) => `${i === 0 ? "M" : "L"}${sx(i)},${sy(s.share)}`)
                .join(" ");
              const stroke = color(config);
              return (
                <g
                  key={config.id}
                  onMouseEnter={() => setActiveId(config.id)}
                  aria-hidden="true"
                >
                  <path d={d} fill="none" stroke="transparent" strokeWidth={16} />
                  <path
                    d={d}
                    fill="none"
                    stroke={stroke}
                    strokeWidth={2}
                    strokeDasharray={config.baseline ? "6 5" : undefined}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                  {steps.map((s, i) => (
                    <circle
                      key={s.label}
                      cx={sx(i)}
                      cy={sy(s.share)}
                      r={MARKER}
                      fill={config.baseline ? "var(--chart-surface)" : stroke}
                      stroke={config.baseline ? stroke : "var(--chart-surface)"}
                      strokeWidth={config.baseline ? 1.5 : 2}
                    />
                  ))}
                </g>
              );
            })}

            {!narrow &&
              series.map(({ config, steps }, i) => {
                const y0 = sy(steps[lastIndex]?.share ?? 0);
                const y = endYs[i]!;
                const x = sx(lastIndex) + 16;
                const strong = config.highlight || config.id === activeId;
                return (
                  <g key={config.id} aria-hidden="true">
                    {Math.abs(y - y0) > 2 && (
                      <line
                        x1={sx(lastIndex) + MARKER + 3}
                        y1={y0}
                        x2={x - 4}
                        y2={y}
                        stroke="var(--rule-strong)"
                        strokeWidth={1}
                      />
                    )}
                    <text
                      className={`chart-text${strong ? " chart-text--strong" : ""}`}
                      x={x}
                      y={y}
                      dominantBaseline="middle"
                    >
                      <tspan className="chart-value" dx={0}>
                        {formatPercent(steps[lastIndex]?.share ?? 0)}
                      </tspan>
                      <tspan dx={8}>{config.label}</tspan>
                    </text>
                  </g>
                );
              })}
          </svg>
        </div>
      </div>

      <ul className="gates__keys" aria-label="Configurations">
        {series.map(({ config, steps }) => (
          <li key={config.id}>
            <button
              type="button"
              aria-pressed={config.id === focusId}
              onMouseEnter={() => setActiveId(config.id)}
              onFocus={() => setActiveId(config.id)}
              onMouseLeave={() => setActiveId(null)}
              onBlur={() => setActiveId(null)}
            >
              <span
                className={`gates__key-line${config.baseline ? " gates__key-line--baseline" : ""}`}
                style={config.baseline ? { borderTopColor: colors[config.id] } : { background: colors[config.id] }}
                aria-hidden="true"
              />
              <span>{config.label}</span>
              <span className="metric">{formatPercent(steps[lastIndex]?.share ?? 0)}</span>
            </button>
          </li>
        ))}
      </ul>

      {focus && (
        <p className="chart__readout" aria-live="polite">
          <strong>{focus.config.label}</strong>
          {focus.steps.map((s, i) => (
            <span key={s.label}>
              {" · "}
              {s.label}{" "}
              {i === 0 ? formatInteger(s.count) : `${formatInteger(s.count)} (${formatPercent(s.share)})`}
            </span>
          ))}
        </p>
      )}

      <details className="chart__table">
        <summary>View exact values</summary>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Harness</th>
                {stageLabels.map((label) => (
                  <th scope="col" className="num" key={label}>
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {series.map(({ config, steps }) => (
                <tr key={config.id}>
                  <th scope="row">{config.label}</th>
                  {steps.map((s, i) => (
                    <td className="num" key={s.label}>
                      {i === 0
                        ? formatInteger(s.count)
                        : `${formatInteger(s.count)} (${formatPercent(s.share)}) −${formatInteger(s.dropped)}`}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      <figcaption className="chart__caption">
        <span>Dataset {datasetVersion}</span>
        <span>Share of each harness's upgrades still passing after each gate, in order</span>
        {input.some((c) => c.baseline) && <span>Dashed: the non-agent package manager bump</span>}
      </figcaption>
    </figure>
  );
}
