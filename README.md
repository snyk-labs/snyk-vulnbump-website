# Snyk VulnBump website

Static landing site for the Snyk VulnBump benchmark: what the benchmark
measured, how, and the results, presented graphically. It shares a technical
foundation with the [Snyk VulnBench website](https://vulnbench.com/) (Astro,
typed data, accessible charts) but has its own visual identity.

## Stack

- [Astro 7](https://astro.build/) static output, with React islands only for
  interactive charts
- TypeScript (strictest), [Zod](https://zod.dev/) validation of the dataset at
  build time
- Geist / Geist Mono on Snyk Midnight (dark-only, per the 2026 brand rules)
- Vitest for the data contract and chart server rendering

## Local development

Requires Node 24.

```sh
npm install
npm run dev        # http://localhost:4321
npm run verify     # astro check + unit tests + production build
npm run social     # re-render the social share card (needs a local Chrome, Brave or Edge)
```

## The benchmark data

The whole site renders from **one file**: `src/data/benchmark.json`,
validated by `src/data/schema.ts`. The build fails if the data breaks the schema or its arithmetic: every rate
must equal its counts, gate counts must never grow, ecosystem rows must sum to
each configuration's totals, every breakdown must cover all fixable
vulnerabilities, remaining vulnerabilities must equal fixable minus cleared,
the paired agreement pattern must reproduce every PASS count and discordant
count, root causes must add up to the failures, version jumps must partition
the upgrades (the bump's on the same upgrades as the agents'), and the
selection funnel must end at the repositories run. `tests/data.test.ts` also
pins the paper's Tables 2–4 and Figures 1, 2 and 4–6 value by value.

| Field | Drives |
| --- | --- |
| `release`, `tagline`, `researchQuestion`, `summary`, `scope` | Hero, footer, page metadata |
| `headline` | Hero stat (highlighted configuration) |
| `paper`, `citation` | Paper title, authors and date; BibTeX on the data page |
| `highlights`, `findings`, `methodology` | Home highlights, the results findings list (the paper's main findings), the methodology pipeline cards (Figure 3) |
| `configurations[].subtitle`, `baseline.subtitle` | One line under each harness in the funnel lanes and leaderboard |
| `metrics` + `configurations[].gates`, `values` | Head-to-head scorecard (Table 2): four gates, "project still works", PASS, instances fixed |
| `configurations[].macro`, `baseline.macro` | Per-repository (macro) PASS rate under the scorecard (section 5.1) |
| `flowSteps` + `configurations[].flow` | Shipping-gates funnel, and failures by first failed gate (Figure 4) |
| `paired` | Discordant upgrades per agent pair and who passes each upgrade (section 5.1) |
| `rootCauses` | Root cause of every failed attempt (Table 4) |
| `jumpCategories` + `configurations[].jumps`, `baseline.jumps` | PASS rate by recommended version jump (Figure 5) |
| `configurations[].ecosystems` | Macro PASS rate by package manager (harness reports; the paper states only the ranking), and per-package-manager gate rates for the leaderboard filter; `vulnsFixed` counts rescan-gate passes |
| `dimensions` + `configurations[].breakdowns`, `baseline.breakdowns` | Per-vulnerability fix and pass rates; fix difficulty and dependency type are Figure 6 |
| `baseline` | The non-agentic package manager bump: drawn dashed or as an outline in the scorecard, gates funnel, failures, version jumps and explorer |
| `adviceSplit` | Paper Table 3: each agent on the 144 upgrades the bump passes and on the other 163 (PASS rates, regressions, gains) |
| `configurations[].run` | Provenance: report folder, harness id, harness revision, Snyk CLI build, report time |
| `failureReasons` + `configurations[].failures` | Per-gate failure counts behind the gate rates |
| `qualitySignals` + `configurations[].quality` | Integrity table |
| `production`, `selection`, `representativeness`, `relatedWork` | Methodology: production context, dataset selection (Figure 1), production comparison (Figure 2), related benchmarks (Table 1) |

To add a new run, add or replace a configuration object; exactly one must be
`"highlight": true`. Downloads are generated from the same data at build time:
`/data/benchmark.json`, `/data/comparison.csv`, `/data/ecosystems.csv`,
`/data/breakdowns.csv`.

## Charts

| Component | Form |
| --- | --- |
| `GateFunnel` | Signature chart: lane grid, one lane per harness, purple block per stage with the drop below it in orange; gate headers select a gate and fill the detail row |
| `Leaderboard` | Agents ranked by a sortable column, filterable by package manager; the baseline is an unranked reference row |
| `GateScorecard` | Head-to-head bars per Table 2 row, best value tagged (including rows a baseline wins), macro PASS rates below |
| `PairedComparison` | Discordant upgrades and macro PASS differences per agent pair, plus an UpSet-style list of which agents passed each upgrade |
| `AdviceSplit` | Table 3: PASS rates on the Snyk-advice-solvable split and the rest, regressions and gains |
| `FailureComparison` | Figure 4 as one fail stack per harness (first failed gate) and Table 4 (root causes) |
| `UpgradeJump` | Figure 5: PASS rate by recommended version jump, the bump dashed |
| `EcosystemComparison` | Macro PASS rate by package manager, grouped bars |
| `VulnBreakdown` | Explorer (Figure 6 and more): per-vulnerability pass or fix rates in buckets, a purple bar per agent on an orange track, the bump dashed where the paper reports it |
| `SelectionFunnel` | Figure 1: candidates by source, then each filter with kept and dropped counts |
| `ProductionComparison` | Figure 2: production against VulnBump, grouped bars and box plots |
| `RelatedWorkTable` | Table 1: benchmarks compared on the checks used to score an attempt |
| `IntegrityTable` | Quality signals side by side |

Each chart labels its marks directly, supports keyboard focus, and ships an
exact-value table and provenance caption in the server-rendered HTML. Agents
are distinguished by labels and fixed purple shades (never by rank), so
labels and tables must stay visible.

## Social share card

Every page carries Open Graph and Twitter `summary_large_image` tags with its
own title and description and one shared 1200 × 630 card, as
[vulnbench.com](https://vulnbench.com/) does. The card is rendered from
`benchmark.json` by `scripts/social-card.mjs` (headline, question, and PASS
rate per harness, in the 2b theme, with the white Snyk wordmark from the brand
kit in `scripts/social/`) into `public/brand/social-<hash>.png`.

The hash fingerprints what the card shows (`src/lib/social.ts`), so social
crawlers fetch a new image when the numbers change, and the production build
fails with "Social card … is missing or stale" until you run `npm run social`
and commit the new PNG. Bump `DESIGN_VERSION` there when the card's design
changes. Set `CHROME_PATH` if the script cannot find a Chromium-based browser.

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
