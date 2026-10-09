import { useId, useState } from "react";
import type { FlowStep } from "../../data/schema";
import { formatInteger, formatPercent } from "../../lib/format";

export interface FunnelLane {
  id: string;
  label: string;
  /** One line under the name, e.g. what the agent is given. */
  subtitle: string;
  highlight: boolean;
  /** The non-agent baseline: drawn as an outline, not a fill. */
  baseline?: boolean;
  /** Upgrades left after each step, aligned with `steps`. */
  flow: number[];
  /** Opacity of the PASS fill (`--op`): 1 for the highlighted agent, then fixed steps. */
  op: string;
}

interface GateFunnelProps {
  lanes: FunnelLane[];
  steps: FlowStep[];
  /** Title and description per gate (steps 1..n), from `metrics`. */
  gates: { label: string; description: string }[];
  datasetVersion: string;
}

/**
 * The gate funnel as a lane grid (2b design): one row per harness, one column
 * per step. In each cell the purple block is the upgrades still passing (its
 * height is a share of all upgrades) and the orange block below it is what
 * that gate dropped. Gate headers are buttons that select a gate; the detail
 * row below the grid describes it and the loss per harness.
 */
export function GateFunnel({ lanes, steps, gates, datasetVersion }: GateFunnelProps) {
  const [selected, setSelected] = useState(Math.min(2, steps.length - 1));
  const detailId = useId();
  const total = Math.max(...lanes.map((l) => l.flow[0] ?? 0), 1);
  const share = (n: number) => `${(n / total) * 100}%`;
  const step = steps[selected]!;
  const gate = gates[selected - 1];

  return (
    <figure className="chart">
      <div className="gatelane-grid" role="group" aria-label="Upgrades passing each gate, per harness">
        <div className="gatelane-head">
          <div className="gatelane-head__corner">
            {`${formatInteger(total)} upgrades`}
            <br />
            {`→ ${steps.length - 1} gates`}
          </div>
          {steps.map((s, i) =>
            i === 0 ? (
              <div className="gatelane-head__start" key={s.label}>
                <small>Start</small>
                <span>{s.label}</span>
              </div>
            ) : (
              <button
                type="button"
                key={s.label}
                aria-pressed={i === selected}
                aria-controls={detailId}
                onClick={() => setSelected(i)}
              >
                <small>{`Gate ${i}`}</small>
                <span>{s.label}</span>
              </button>
            ),
          )}
        </div>

        {lanes.map((lane) => {
          const final = lane.flow[lane.flow.length - 1] ?? 0;
          return (
            <div
              key={lane.id}
              className={`gatelane${lane.highlight ? " gatelane--highlight" : ""}${lane.baseline ? " gatelane--baseline" : ""}`}
              style={{ "--op": lane.op } as React.CSSProperties}
            >
              <div className="gatelane__name">
                <strong>{lane.label}</strong>
                <span>{lane.subtitle}</span>
                <div className="gatelane__final">
                  {formatPercent(final / total)} <small>PASS</small>
                </div>
              </div>
              {lane.flow.map((n, i) => {
                const drop = i > 0 ? (lane.flow[i - 1] ?? n) - n : 0;
                return (
                  <div
                    className="gatelane__stage"
                    key={steps[i]?.label ?? i}
                    aria-current={i === selected ? "true" : undefined}
                  >
                    <div className="gatelane__bars" aria-hidden="true">
                      <div className="gatelane__pass" style={{ height: share(n) }}>
                        {formatInteger(n)}
                      </div>
                      <div className="gatelane__drop" style={{ height: share(drop) }} />
                    </div>
                    <div className="gatelane__loss">
                      <span aria-hidden="true">{drop > 0 ? `−${formatInteger(drop)}` : ""}</span>
                      <span className="visually-hidden">
                        {steps[i]?.label}: {formatInteger(n)} of {formatInteger(total)}
                        {drop > 0 ? `, ${formatInteger(drop)} dropped` : ""}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}

        <div className="gate-detail" id={detailId} aria-live="polite">
          <div className="gate-detail__kicker">Selected gate</div>
          <div
            className="gate-detail__body"
            style={{ "--detail-cols": lanes.length } as React.CSSProperties}
          >
            <div>
              <div className="gate-detail__title">{`Gate ${selected} · ${step.label}`}</div>
              {gate && <p className="gate-detail__desc">{gate.description}</p>}
            </div>
            {lanes.map((lane) => {
              const before = lane.flow[selected - 1] ?? 0;
              const after = lane.flow[selected] ?? 0;
              return (
                <div key={lane.id}>
                  <div className="gate-detail__name">{lane.label}</div>
                  <div className="gate-detail__loss">{`−${formatInteger(before - after)}`}</div>
                  <div className="gate-detail__note">
                    {`${(step.dropLabel ?? "dropped").toLowerCase()} · ${formatInteger(after)} continue`}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <details className="chart__table">
        <summary>View exact values</summary>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Harness</th>
                {steps.map((s) => (
                  <th scope="col" className="num" key={s.label}>
                    {s.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lanes.map((lane) => (
                <tr key={lane.id}>
                  <th scope="row">{lane.label}</th>
                  {lane.flow.map((n, i) => (
                    <td className="num" key={steps[i]?.label ?? i}>
                      {i === 0
                        ? formatInteger(n)
                        : `${formatInteger(n)} (${formatPercent(n / total)}) −${formatInteger((lane.flow[i - 1] ?? n) - n)}`}
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
        <span>Purple: upgrades still passing after each gate, in order · orange: dropped at that gate</span>
        {lanes.some((l) => l.baseline) && <span>Outlined: the non-agent package manager bump</span>}
      </figcaption>
    </figure>
  );
}
