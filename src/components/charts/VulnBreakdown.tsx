import { useState } from "react";
import type { BreakdownCategory, Dimension } from "../../data/schema";
import { configColors } from "../../lib/colors";
import { formatInteger, formatWholePercent } from "../../lib/format";

export interface BreakdownSeries {
  id: string;
  label: string;
  highlight: boolean;
  breakdowns: Record<string, BreakdownCategory[]>;
}

interface VulnBreakdownProps {
  series: BreakdownSeries[];
  dimensions: Dimension[];
  datasetVersion: string;
}

type RateKey = "passRate" | "fixRate";

const rates: { key: RateKey; label: string; description: string }[] = [
  {
    key: "passRate",
    label: "Pass rate",
    description: "cleared by an attempt that also passed every other gate",
  },
  {
    key: "fixRate",
    label: "Fix rate",
    description: "cleared on the Snyk rescan, regardless of build or tests",
  },
];

/**
 * Per-vulnerability results by category: grouped bars, one per configuration,
 * with a dimension switcher and a fix-rate / pass-rate switcher. Values are
 * whole percentages, as reported by the harness.
 */
export function VulnBreakdown({ series, dimensions, datasetVersion }: VulnBreakdownProps) {
  const [dimensionId, setDimensionId] = useState(dimensions[0]?.id ?? "");
  const [rateKey, setRateKey] = useState<RateKey>("passRate");
  const [active, setActive] = useState<{ category: string; id: string } | null>(null);

  const colors = configColors(series);
  const dimension = dimensions.find((d) => d.id === dimensionId) ?? dimensions[0]!;
  const rate = rates.find((r) => r.key === rateKey)!;
  const present = series.filter((s) => s.breakdowns[dimension.id]);
  const categories = present[0]?.breakdowns[dimension.id]?.map((c) => c.label) ?? [];

  const cell = (s: BreakdownSeries, label: string) =>
    s.breakdowns[dimension.id]?.find((c) => c.label === label);

  const focusSeries =
    present.find((s) => s.id === active?.id) ?? present.find((s) => s.highlight) ?? present[0];
  const focusCategory = active?.category ?? categories[0];
  const focusCell = focusSeries && focusCategory ? cell(focusSeries, focusCategory) : undefined;

  return (
    <figure className="chart">
      <div className="chart__toolbar">
        <div className="chart__segmented" role="group" aria-label="Group by">
          {dimensions.map((d) => (
            <button
              key={d.id}
              type="button"
              aria-pressed={d.id === dimension.id}
              onClick={() => setDimensionId(d.id)}
            >
              {d.label}
            </button>
          ))}
        </div>
        <div className="chart__segmented" role="group" aria-label="Rate">
          {rates.map((r) => (
            <button
              key={r.key}
              type="button"
              aria-pressed={r.key === rateKey}
              onClick={() => setRateKey(r.key)}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <ul className="chart__legend" aria-label="Configurations">
        {present.map((s) => (
          <li key={s.id}>
            <span className="chart__swatch" style={{ background: colors[s.id] }} aria-hidden="true" />
            {s.label}
          </li>
        ))}
        {dimension.note && <li className="chart__hint">{dimension.note}</li>}
      </ul>

      <div className="chart__plot">
        <div className="breakdown__groups">
          {categories.map((label) => (
            <section className="breakdown__group" key={label} aria-label={label}>
              <h3 className="breakdown__label">{label}</h3>
              <ul className="breakdown__bars">
                {present.map((s) => {
                  const c = cell(s, label);
                  const value = c?.[rateKey] ?? 0;
                  return (
                    <li
                      key={s.id}
                      tabIndex={0}
                      aria-label={`${label}, ${s.label}: ${rate.label} ${formatWholePercent(value)} of ${formatInteger(c?.n ?? 0)} vulnerabilities`}
                      onMouseEnter={() => setActive({ category: label, id: s.id })}
                      onFocus={() => setActive({ category: label, id: s.id })}
                    >
                      <span className="breakdown__track">
                        <span
                          className="breakdown__bar"
                          style={{ width: `calc((100% - 3.5rem) * ${value})`, background: colors[s.id] }}
                        />
                        <span className="breakdown__value metric">{formatWholePercent(value)}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      </div>

      {focusSeries && focusCell && (
        <p className="chart__readout" aria-live="polite">
          <strong>{focusSeries.label}</strong> · {dimension.label}: {focusCategory} · {rate.label}{" "}
          {formatWholePercent(focusCell[rateKey])} of {formatInteger(focusCell.n)} vulnerabilities ({rate.description})
        </p>
      )}

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
              {categories.map((label) => (
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
        <span>Per targeted vulnerability, not per attempt · rounded to whole percent as reported</span>
        <span>A failed attempt counts against every vulnerability it targeted, so these run below per-attempt rates</span>
      </figcaption>
    </figure>
  );
}
