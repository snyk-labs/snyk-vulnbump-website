import { useState } from "react";
import { formatPercent } from "../../lib/format";

export type BoardKey = "pass" | "fixed" | "deps" | "build" | "tests";
type Rates = Record<BoardKey, number>;

export interface BoardEcosystem {
  id: string;
  attempts: number;
  passed: number;
  /** Attempts passing the rescan gate. */
  vulnsFixed: number;
  depsResolveRate: number;
  buildPassRate: number;
  testsPassRate: number;
}

export interface BoardAgent {
  id: string;
  label: string;
  subtitle: string;
  highlight: boolean;
  attempts: number;
  /** Rates over all upgrades. */
  overall: Rates;
  ecosystems: BoardEcosystem[];
}

export interface BoardBaseline {
  id: string;
  label: string;
  subtitle: string;
  attempts: number;
  overall: Rates;
}

export const BOARD_COLUMNS: { key: BoardKey; label: string }[] = [
  { key: "pass", label: "PASS" },
  { key: "fixed", label: "Targeted vulns fixed" },
  { key: "deps", label: "Deps" },
  { key: "build", label: "Build" },
  { key: "tests", label: "Tests" },
];

/** Rates for one agent, overall or within one ecosystem. */
export function agentRates(agent: BoardAgent, ecosystem: string): { rates: Rates; attempts: number } {
  if (ecosystem === "all") return { rates: agent.overall, attempts: agent.attempts };
  const e = agent.ecosystems.find((x) => x.id === ecosystem);
  if (!e) throw new Error(`Unknown ecosystem "${ecosystem}"`);
  return {
    rates: {
      pass: e.passed / e.attempts,
      fixed: e.vulnsFixed / e.attempts,
      deps: e.depsResolveRate,
      build: e.buildPassRate,
      tests: e.testsPassRate,
    },
    attempts: e.attempts,
  };
}

/** Agents ranked by `key` (dir -1 = descending), with the best value per column. */
export function leaderboardRows(agents: BoardAgent[], ecosystem: string, key: BoardKey, dir: 1 | -1) {
  const rows = agents.map((a) => ({ agent: a, ...agentRates(a, ecosystem) }));
  const best = Object.fromEntries(
    BOARD_COLUMNS.map((c) => [c.key, Math.max(...rows.map((r) => r.rates[c.key]))]),
  ) as Rates;
  rows.sort((a, b) => dir * (a.rates[key] - b.rates[key]));
  return { rows, best };
}

interface LeaderboardProps {
  agents: BoardAgent[];
  baseline?: BoardBaseline;
  ecosystems: { id: string; label: string }[];
  /** Section heading, rendered beside the filter pills. */
  eyebrow: string;
  title: string;
  titleId: string;
}

/**
 * Leaderboard (2b design): agents ranked by a sortable column, optionally
 * within one ecosystem. Rates are recomputed from each agent's ecosystem
 * rows. The non-agentic baseline is an unranked reference row, shown only for
 * all upgrades because it has no per-ecosystem breakdown.
 */
export function Leaderboard({ agents, baseline, ecosystems, eyebrow, title, titleId }: LeaderboardProps) {
  const [sortKey, setSortKey] = useState<BoardKey>("pass");
  const [dir, setDir] = useState<1 | -1>(-1);
  const [ecosystem, setEcosystem] = useState("all");

  const { rows, best } = leaderboardRows(agents, ecosystem, sortKey, dir);
  const ecoLabel = ecosystems.find((e) => e.id === ecosystem)?.label;
  const showBaseline = ecosystem === "all" && baseline;
  const attempts = rows[0]?.attempts ?? 0;

  const sortBy = (key: BoardKey) => {
    if (key === sortKey) setDir(dir === -1 ? 1 : -1);
    else {
      setSortKey(key);
      setDir(-1);
    }
  };

  return (
    <div className="leaderboard">
      <div className="board-head">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2 className="section-title" id={titleId}>
            {title}
          </h2>
        </div>
        <div className="pill-row" role="group" aria-label="Package manager">
        {[{ id: "all", label: "All" }, ...ecosystems].map((e) => (
          <button
            type="button"
            className="pill"
            key={e.id}
            aria-pressed={e.id === ecosystem}
            onClick={() => setEcosystem(e.id)}
          >
            {e.label}
          </button>
        ))}
        </div>
      </div>

      <div className="board" role="table" aria-label={`Agents ranked by ${BOARD_COLUMNS.find((c) => c.key === sortKey)?.label}`}>
        <div role="rowgroup">
          <div className="board__row board__row--head" role="row">
            <div className="board__head-cell" role="columnheader">#</div>
            <div className="board__head-cell" role="columnheader">Agent</div>
            {BOARD_COLUMNS.map((c) => (
              <div
                key={c.key}
                role="columnheader"
                aria-sort={c.key === sortKey ? (dir === -1 ? "descending" : "ascending") : undefined}
              >
                <button type="button" onClick={() => sortBy(c.key)}>
                  {c.label} <span aria-hidden="true">{c.key === sortKey ? (dir === -1 ? "↓" : "↑") : ""}</span>
                </button>
              </div>
            ))}
          </div>
        </div>
        <div role="rowgroup">
          {rows.map(({ agent, rates }, i) => (
            <div
              key={agent.id}
              role="row"
              className={`board__row${agent.highlight ? " board__row--highlight" : ""}`}
            >
              <div className="board__cell board__rank" role="cell">
                {String(i + 1).padStart(2, "0")}
              </div>
              <div className="board__cell board__agent" role="rowheader">
                <strong>{agent.label}</strong>
                <span>{agent.subtitle}</span>
              </div>
              <div className="board__cell board__pass" role="cell">
                <span className={`board__pass-value${rates.pass === best.pass ? " board__cell--best" : ""}`}>
                  {formatPercent(rates.pass)}
                </span>
                <span className="passbar" aria-hidden="true">
                  <span style={{ width: `${rates.pass * 100}%` }} />
                </span>
              </div>
              {BOARD_COLUMNS.slice(1).map((c) => (
                <div
                  key={c.key}
                  role="cell"
                  className={`board__cell${rates[c.key] === best[c.key] ? " board__cell--best" : ""}`}
                >
                  {formatPercent(rates[c.key])}
                </div>
              ))}
            </div>
          ))}
          {showBaseline && (
            <div role="row" className="board__row board__row--baseline">
              <div className="board__cell board__rank" role="cell">
                <span aria-hidden="true">—</span>
                <span className="visually-hidden">Not ranked</span>
              </div>
              <div className="board__cell board__agent" role="rowheader">
                <strong>{baseline.label}</strong>
                <span>{baseline.subtitle} · non-agentic baseline</span>
              </div>
              <div className="board__cell board__pass" role="cell">
                <span className="board__pass-value">{formatPercent(baseline.overall.pass)}</span>
                <span className="passbar passbar--baseline" aria-hidden="true">
                  <span style={{ width: `${baseline.overall.pass * 100}%` }} />
                </span>
              </div>
              {BOARD_COLUMNS.slice(1).map((c) => (
                <div key={c.key} role="cell" className="board__cell">
                  {formatPercent(baseline.overall[c.key])}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <p className="board__note">
        Targeted vulns fixed: share of upgrades whose rescan shows every targeted vulnerability fixed (the rescan
        gate), not the share of vulnerability instances.{" "}
        {ecosystem === "all"
          ? `${attempts} upgrades per agent. Click a column to sort.${baseline ? ` The ${baseline.label.toLowerCase()} is a reference, not ranked.` : ""}`
          : `${attempts} ${ecoLabel} upgrades per agent. Click a column to sort.${baseline ? ` The ${baseline.label.toLowerCase()} has no per-package-manager breakdown.` : ""}`}
      </p>
    </div>
  );
}
