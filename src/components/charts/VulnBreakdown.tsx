import { useState } from "react";
import type { BreakdownCategory, Dimension } from "../../data/schema";
import { formatInteger, formatWholePercent } from "../../lib/format";

export interface BreakdownSeries {
  id: string;
  label: string;
  highlight: boolean;
  /** Opacity of the PASS fill (`--op`) for this agent. */
  op: string;
  breakdowns: Record<string, BreakdownCategory[]>;
}

interface VulnBreakdownProps {
  /** Agents in display order. */
  series: BreakdownSeries[];
  dimensions: Dimension[];
  datasetVersion: string;
}

type RateKey = "passRate" | "fixRate";

const rates: { key: RateKey; label: string; miss: string; caption: string }[] = [
  {
    key: "passRate",
    label: "Pass rate",
    miss: "did not pass",
    caption: "Bars show the share of vulnerability instances fixed by a PASS, within each bucket.",
  },
  {
    key: "fixRate",
    label: "Fix rate",
    miss: "not fixed",
    caption: "Bars show the share of vulnerability instances cleared on the rescan, whether or not the attempt passed the other gates.",
  },
];

/**
 * The explorer (2b design): per-vulnerability results in buckets of one
 * dimension. Each agent gets a purple bar (at its opacity) on an orange
 * track, so the orange that remains is what did not pass. Values are whole
 * percentages, as reported by the harness.
 */
export function VulnBreakdown({ series, dimensions, datasetVersion }: VulnBreakdownProps) {
  const [dimensionId, setDimensionId] = useState(dimensions[0]?.id ?? "");
  const [rateKey, setRateKey] = useState<RateKey>("passRate");

  const dimension = dimensions.find((d) => d.id === dimensionId) ?? dimensions[0]!;
  const rate = rates.find((r) => r.key === rateKey)!;
  const present = series.filter((s) => s.breakdowns[dimension.id]);
  const categories = present[0]?.breakdowns[dimension.id] ?? [];
  const cell = (s: BreakdownSeries, label: string) =>
    s.breakdowns[dimension.id]?.find((c) => c.label === label);

  return (
    <figure className="chart">
      <div className="explorer__controls">
        <div className="pill-row" role="group" aria-label="Group by">
          {dimensions.map((d) => (
            <button
              type="button"
              className="pill"
              key={d.id}
              aria-pressed={d.id === dimension.id}
              onClick={() => setDimensionId(d.id)}
            >
              {d.label}
            </button>
          ))}
        </div>
        <div className="pill-row" role="group" aria-label="Rate">
          {rates.map((r) => (
            <button
              type="button"
              className="pill"
              key={r.key}
              aria-pressed={r.key === rateKey}
              onClick={() => setRateKey(r.key)}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <p className="explorer__note">{dimension.note ?? "Share of vulnerability instances in each bucket."}</p>

      <ul className="explorer__legend" aria-label="Legend">
        {present.map((s) => (
          <li key={s.id}>
            <span className="explorer__swatch" style={{ "--op": s.op } as React.CSSProperties} aria-hidden="true" />
            {s.label}
          </li>
        ))}
        <li>
          <span className="explorer__swatch explorer__swatch--fail" aria-hidden="true" />
          {rate.miss}
        </li>
      </ul>

      <div className="explorer__panel panel-card">
        {categories.map((category) => (
          <section className="explorer__bucket" key={category.label} aria-label={category.label}>
            <div>
              <h3 className="explorer__label">{category.label}</h3>
              <p className="explorer__n metric">{formatInteger(category.n)} vulnerabilities</p>
            </div>
            <ul className="explorer__bars">
              {present.map((s) => {
                const value = cell(s, category.label)?.[rateKey] ?? 0;
                return (
                  <li key={s.id} aria-label={`${s.label}: ${rate.label.toLowerCase()} ${formatWholePercent(value)}`}>
                    <span className="passtrack" style={{ "--op": s.op } as React.CSSProperties} aria-hidden="true">
                      <span style={{ width: `${value * 100}%` }} />
                    </span>
                    <span className="explorer__value metric" aria-hidden="true">
                      {formatWholePercent(value)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      <details className="chart__table">
        <summary>View exact values</summary>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">{dimension.label}</th>
                {present.map((s) => (
                  <th scope="col" className="num" key={s.id}>
                    {s.label}: fix / pass (n)
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {categories.map(({ label }) => (
                <tr key={label}>
                  <th scope="row">{label}</th>
                  {present.map((s) => {
                    const c = cell(s, label);
                    return (
                      <td className="num" key={s.id}>
                        {c
                          ? `${formatWholePercent(c.fixRate)} / ${formatWholePercent(c.passRate)} (${formatInteger(c.n)})`
                          : "—"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      <figcaption className="chart__caption">
        <span>Dataset {datasetVersion}</span>
        <span>{rate.caption}</span>
        <span>Per targeted vulnerability, not per attempt · rounded to whole percent</span>
      </figcaption>
    </figure>
  );
}
