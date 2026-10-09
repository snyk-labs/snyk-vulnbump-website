# Snyk VulnBump website

Static landing site for the Snyk VulnBump benchmark: what the benchmark
measured, how, and the results, presented graphically. It shares a technical
foundation with the [Snyk VulnBench website](https://vulnbench.com/) (Astro,
typed data, accessible charts) but has its own visual identity, built on the
Snyk 2026 brand system.

> **Status: draft.** Agent figures come from the three harness reports of the
> 2026-10-04/05 single-upgrade runs (Evo Remediation Agent, harness `remy`;
> Claude Code + Snyk scan; Claude Code unaided) in `snyk/remy-benchmark`
> (`benchmarking/reports/*-easy`). The site follows draft v2 of the VulnBump
> paper (Pasiunaite et al., 9 October 2026), including its names and its
> non-agent baseline, the package manager bump. Every agent number in the
> paper is reproduced here and agrees with the reports. While `release.status` is `"draft"`, every page shows a review
> banner and is marked `noindex`.

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
| `headline` | Hero numeral (highlighted configuration) and comparison chips |
| `paper`, `citation` | Paper title, authors and date; BibTeX in the closing section |
| `highlights`, `findings`, `methodology` | Results "at a glance", findings index (the paper's main findings), the three-phase pipeline (Figure 3) |
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

The visual system follows the Snyk 2026 brand guidelines rather than
VulnBench's light editorial look:

- **Midnight canvas, no light mode.** The brand disallows white canvases, so
  the site is dark-only; corner fabric sits on one diagonal (hero bottom-right,
  closing statement top-left).
- **Gradient keywords as inline SVG**, never `background-clip: text`, one per
  section (`src/components/brand/GradientText.astro`).
- **Numeral-as-hero**: the headline share drawn as a gradient neon outline with
  a glow (`HeroNumeral.astro`), sized to its column with container units.
- **Geist Mono** for eyebrows (`// LABEL`), navigation, buttons, and data
  labels; pill buttons; gradient borders drawn with per-edge `border-*`.
- Only the five locked brand colours, Midnight, and white alphas.

Run the brand's mechanical audit (`apply-brand-guidelines/scripts/audit_html.py`)
against built pages after visual changes.

## Charts

| Component | Form |
| --- | --- |
| `GateFunnel` | Signature chart: share of attempts surviving each gate, one line per configuration |
| `GateScorecard` | Head-to-head bars per Table 2 row, best value tagged (including rows a baseline wins) |
| `RepoLevelTable` | Table 3: macro rates with intervals, repositories all or none passing, remaining instances |
| `PairedComparison` | McNemar and bootstrap results, plus an UpSet-style list of which agents passed each upgrade |
| `AdviceSplit` | Table 4: PASS rates on the Snyk-advice-solvable split and the rest, regressions and value-add |
| `FailureComparison` | Figure 4 (first failed gate) and Table 4 (root causes) |
| `UpgradeJump` | Figure 5: PASS rate by recommended version jump |
| `EcosystemComparison` | Figure 6: macro PASS rate by package manager, grouped bars |
| `VulnBreakdown` | Figure 7: per-vulnerability fix/pass rates by fix difficulty, dependency type, package manager, severity |
| `SelectionFunnel` | Figure 1: candidates by source, then each filter with kept and dropped counts |
| `ProductionComparison` | Figure 2: production against VulnBump, grouped bars and box plots |
| `RelatedWorkTable` | Table 1: benchmarks compared on the checks used to score an attempt |
| `CostLatency` | Percentile strips (median, mean, p90, p95) for latency and cost |
| `IntegrityTable` | Quality signals side by side |

Each chart labels its marks directly, supports keyboard focus, and ships an
exact-value table and provenance caption in the server-rendered HTML. The
highlighted configuration is Hot Pink; the other agents are muted white, and the non-agent baseline is a dashed outline.

Categorical series use the locked brand hues in the order Hot Pink, Amber,
Purple, Orange-Red. On Midnight that order passes colour-vision-deficiency and
normal-vision separation checks. Purple is 2.6:1 against Midnight and the
locked palette cannot meet an even-lightness band, so labels and tables must
stay visible.

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
    home/        homepage sections
    results/     results-page sections (scorecard, paired, failures, version jump, ...)
    methodology/ dataset selection, production comparison, related-work table
    brand/       gradient keyword and neon numeral (inline SVG)
    site/        header, footer, page hero, fabric, logo
  layouts/       BaseLayout (metadata, theme bootstrap, preview banner)
  pages/         /, /results, /methodology, /data, /about, 404, data downloads
  styles/        tokens.css, charts.css, global.css
public/brand/    approved Snyk 2026 assets (see PROVENANCE.md for checksums)
tests/           Vitest suites
```

## License

[Apache License 2.0](LICENSE).
