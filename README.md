# Snyk VulnBump website

Static landing site for the Snyk VulnBump benchmark: what the benchmark
measured, how, and the results, presented graphically. It shares a technical
foundation with the [Snyk VulnBench website](https://vulnbench.com/) (Astro,
typed data, accessible charts) but has its own visual identity: the "2b"
Gatehouse theme (Snyk purple for PASS, orange for FAIL, solid fills only).

> **Status: draft.** Agent figures come from the three harness reports of the
> 2026-10-04/05 single-upgrade runs (Evo Remediation Agent, harness `remy`;
> Claude Code + Snyk scan; Claude Code unaided) in `snyk/remy-benchmark`
> (`benchmarking/reports/*-easy`). The site follows draft v2 of the VulnBump
> paper (Pasiunaite et al., 9 October 2026), including its names and its
> non-agent baseline, the package manager bump. Every agent number in the
> paper is reproduced here and agrees with the reports. While `release.status` is `"draft"`, the header tag reads
> "1.0 draft" and every page is marked `noindex`.

## Stack

- [Astro 7](https://astro.build/) static output, with React islands only for
  interactive charts
- TypeScript (strictest), [Zod](https://zod.dev/) validation of the dataset at
  build time
- Geist / Geist Mono on Snyk Midnight (dark-only, per the 2026 brand rules)
- Vitest for the data contract and chart server rendering
- Deployed on Vercel (`vercel.json`)

## Local development

Requires Node 24.

```sh
npm install
npm run dev        # http://localhost:4321
npm run verify     # astro check + unit tests + production build
```

## The benchmark data

The whole site renders from **one file**: `src/data/benchmark.json`,
validated by `src/data/schema.ts`. The `configurations` figures are computed
from the harness reports with the harness's own report code
(`functional.pdf_report`, against `cases-43/cases.yaml`), not copied from a
PDF, so rates keep full precision. Per-attempt recomputation confirms the
paper's derived figures too (per-gate rates, paired McNemar counts, version
jumps, macro rates by package manager, first failed gate). A few values exist
only in the paper and are taken from it as published: the 10,000-resample
bootstrap intervals, the paired-difference intervals, the Table 4 root causes
(manually annotated), the production distributions, and the related-work
comparison (Table 1). The package manager bump ran outside the harness
reports (8 October), so its figures (`baseline`, `adviceSplit`, and its
columns in `rootCauses`) come from the paper alone; the schema checks them for
internal consistency (gate rates against counts, flow against Figure 4, every
split against its totals, each agent's split against its PASS count).

The build fails if the data breaks the schema or its arithmetic: every rate
must equal its counts, gate counts must never grow, ecosystem rows must sum to
each configuration's totals, every breakdown must cover all fixable
vulnerabilities, remaining vulnerabilities must equal fixable minus cleared,
each macro rate must sit inside its interval, the paired agreement pattern
must reproduce every PASS count and discordant count, root causes must add up
to the failures, version jumps must partition the upgrades, and the selection
funnel must end at the repositories run. `tests/data.test.ts` also pins the
paper's Tables 2–4 and Figures 1 and 4–6 value by value.

| Field | Drives |
| --- | --- |
| `release`, `tagline`, `researchQuestion`, `summary`, `scope` | Hero, footer, page metadata |
| `headline` | Hero stat (highlighted configuration) |
| `paper`, `citation` | Paper title, authors and date; BibTeX on the data page |
| `highlights`, `findings`, `methodology` | Home highlights, the results findings list (the paper's main findings), the methodology pipeline cards (Figure 3) |
| `configurations[].subtitle`, `baseline.subtitle` | One line under each harness in the funnel lanes and leaderboard |
| `metrics` + `configurations[].gates`, `values` | Head-to-head scorecard (Table 2): four gates, "project still works", PASS, instances fixed |
| `configurations[].macro`, `macroFixed`, `reposAllPass`, `reposNonePass` | Repository-level results (Table 3) |
| `flowSteps` + `configurations[].flow` | Shipping-gates funnel, and failures by first failed gate (Figure 4) |
| `paired` | Paired comparisons and who passes each upgrade (section 5.2) |
| `rootCauses` | Root cause of every failed attempt (Table 4) |
| `jumpCategories` + `configurations[].jumps` | PASS rate by recommended version jump (Figure 5) |
| `configurations[].ecosystems` | Macro PASS rate by package manager (Figure 6) |
| `dimensions` + `configurations[].breakdowns` | Per-vulnerability fix and pass rates (Figure 7) |
| `baseline` | The non-agent package manager bump: drawn dashed or as an outline in the scorecard, gates funnel, repository-level table and failures |
| `adviceSplit` | Paper Table 4: each agent on the 144 upgrades the bump passes and on the other 163 (regressions, value-add, McNemar) |
| `configurations[].run` | Provenance: report folder, harness id, harness revision, Snyk CLI build, report time |
| `failureReasons` + `configurations[].failures` | Per-gate failure counts behind the gate rates |
| `configurations[].cost`, `latencySeconds` | Cost and latency percentiles. `tokens` is kept in the download but not charted: the harness says token counts are not comparable across the Evo Remediation Agent and Claude Code |
| `qualitySignals` + `configurations[].quality` | Integrity table |
| `production`, `selection`, `representativeness`, `relatedWork` | Methodology: production context, dataset selection (Figure 1), production comparison (Figure 2), related benchmarks (Table 1) |

To add a new run, add or replace a configuration object; exactly one must be
`"highlight": true`. Downloads are generated from the same data at build time:
`/data/benchmark.json`, `/data/comparison.csv`, `/data/ecosystems.csv`,
`/data/breakdowns.csv`.

## Design

The site uses the **2b "Gatehouse" theme** from the Claude Design handoff
(`design_handoff_vulnbump_2b/`): every upgrade passes or fails four gates, so
PASS is solid purple and FAIL solid orange, with no gradients.

- **Tokens** (`src/styles/tokens.css`, from the handoff's drop-in): `--paper`
  #0B0613, `--panel` #14091F, `--pass` #8F3CE8 (text tint `--pass-text`
  #C481F3), `--fail` #FF8904 and the fail stack by gate, `--accent` and the
  focus ring. Every older token name is kept, so `--pink` now means the
  lavender accent.
- **Theme** (`src/styles/theme-2b.css`, loaded after `global.css` by
  `BaseLayout`): buttons, eyebrows, the lane grid, leaderboard, pills, caveats
  and fail stacks. Its pass-on-fail bar is `.passtrack`; the handoff's `.track`
  name was already used by the existing charts.
- **Agent shades**: the highlighted agent is solid `--pass`; the others are
  `--pass` mixed into the panel at the theme's fixed steps (0.62 for Claude
  Code + Snyk scan, 0.34 for Claude Code unaided), so counts inside the bars
  stay legible. The non-agent baseline is a dashed outline.
- **Type**: Geist 600 headlines (tracking -0.04em), Geist Mono for labels and
  numbers. Purple #8F3CE8 is about 3.9:1 on the paper, so it carries fills,
  never small text.

The 2b palette departs from the Snyk 2026 locked palette, so the brand's
mechanical audit (`apply-brand-guidelines/scripts/audit_html.py`) flags it;
brand review signs off on the theme as a whole.

## Charts

| Component | Form |
| --- | --- |
| `GateFunnel` | Signature chart: lane grid, one lane per harness, purple block per stage with the drop below it in orange; gate headers select a gate and fill the detail row |
| `Leaderboard` | Agents ranked by a sortable column, filterable by package manager; the baseline is an unranked reference row |
| `GateScorecard` | Head-to-head bars per Table 2 row, best value tagged (including rows a baseline wins) |
| `RepoLevelTable` | Table 3: macro rates with intervals, repositories all or none passing, remaining instances |
| `PairedComparison` | McNemar and bootstrap results, plus an UpSet-style list of which agents passed each upgrade |
| `AdviceSplit` | Table 4: PASS rates on the Snyk-advice-solvable split and the rest, regressions and value-add |
| `FailureComparison` | Figure 4 as one fail stack per harness (first failed gate) and Table 5 (root causes) |
| `UpgradeJump` | Figure 5: PASS rate by recommended version jump |
| `EcosystemComparison` | Figure 6: macro PASS rate by package manager, grouped bars |
| `VulnBreakdown` | Explorer (Figure 7): per-vulnerability pass or fix rates in buckets, a purple bar per agent on an orange track |
| `SelectionFunnel` | Figure 1: candidates by source, then each filter with kept and dropped counts |
| `ProductionComparison` | Figure 2: production against VulnBump, grouped bars and box plots |
| `RelatedWorkTable` | Table 1: benchmarks compared on the checks used to score an attempt |
| `CostLatency` | Percentile strips (median, mean, p90, p95) for latency and cost |
| `IntegrityTable` | Quality signals side by side |

Each chart labels its marks directly, supports keyboard focus, and ships an
exact-value table and provenance caption in the server-rendered HTML. Agents
are distinguished by labels and fixed purple shades (never by rank), so
labels and tables must stay visible.

## Deploying to Vercel

1. Import `snyk-labs/snyk-vulnbump-website` in Vercel. The Astro preset and
   `vercel.json` already set install/build commands and `dist` as output.
2. Set `SITE_URL` (for example `https://vulnbump.com`) so canonical URLs and the
   sitemap use the production domain. Without it, Vercel's production hostname
   is used.
3. Before launch, set `release.status` to `"published"` (and `publishedAt`) in
   `src/data/benchmark.json`.

`vercel.json` serves clean URLs without trailing slashes, caches hashed
`/_astro/*` assets for a year, and sets baseline security headers. No analytics
are included.

## Project layout

```
src/
  data/          benchmark.json (dataset), schema.ts (contract), index.ts (accessors, nav)
  components/
    charts/      React chart islands
    home/        homepage sections (hero, highlights, leaderboard, closing panel)
    results/     results-page sections (findings, scorecard, paired, failures, version jump, ...)
    methodology/ overview blocks, dataset selection, production comparison, related-work table
    site/        header, footer, page hero, wordmark, citation
  layouts/       BaseLayout (metadata, stylesheets)
  pages/         /, /results, /methodology, /data, /about, 404, data downloads
  styles/        tokens.css, theme-2b.css, charts.css, global.css
public/brand/    logo-mark.svg (2b mark: ascending purple steps, the last cut short in orange)
tests/           Vitest suites
```

## License

[Apache License 2.0](LICENSE).
