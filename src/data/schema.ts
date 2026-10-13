import { z } from "zod";

/*
 * Contract for the benchmark dataset that drives every page and chart.
 *
 * The site renders from one validated JSON document (src/data/benchmark.json),
 * computed from the harness reports and aligned with the VulnBump paper. The
 * build fails if it does not satisfy this schema or if its internal arithmetic
 * disagrees (gate counts, ecosystem totals, breakdown denominators, paired
 * comparisons, root causes), which catches transcription errors.
 */

const id = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]*$/, "Use lowercase kebab-case identifiers");
const key = z.string().regex(/^[a-z][a-zA-Z0-9]*$/, "Use camelCase keys");
const nonEmpty = z.string().trim().min(1);
const count = z.number().int().nonnegative();
const rate = z.number().min(0).max(1);
const percent = z.number().min(0).max(100);
const optionalUrl = z.url().nullable();
/** Counts keyed by configuration id. */
const perConfig = z.record(id, count);

const percentilesSchema = z.object({
  mean: z.number().nonnegative(),
  p50: z.number().nonnegative(),
  p90: z.number().nonnegative(),
  p95: z.number().nonnegative(),
});

/** Critical / high / medium / low. */
const severityCountsSchema = z.tuple([count, count, count, count]);

const gateKeys = ["depsResolve", "vulnsFixed", "cleanBuild", "testsPass"] as const;

export const metricSchema = z.object({
  key,
  label: nonEmpty,
  description: nonEmpty,
  /** What the percentage is a share of. */
  basis: z.enum(["attempts", "vulnerabilities"]),
  /** One of the four gates, an outcome derived from them, or the PASS verdict. */
  kind: z.enum(["gate", "outcome", "verdict"]),
});

const ecosystemResultSchema = z.object({
  id,
  repos: count,
  attempts: count,
  depsResolveRate: rate,
  vulnsCleared: count,
  vulnsFixable: count,
  buildPassRate: rate,
  testsPassRate: rate,
  passed: count,
  /** Mean of per-repository PASS rates. */
  macroPassRate: rate,
});

const breakdownCategorySchema = z.object({
  label: nonEmpty,
  n: count,
  fixRate: rate,
  passRate: rate,
});

export const configurationSchema = z.object({
  id,
  label: nonEmpty,
  /** For narrow column headers only; charts and tables use `label`. */
  shortLabel: nonEmpty,
  /** One line under the name in lanes and the leaderboard. */
  subtitle: nonEmpty,
  description: nonEmpty,
  kind: z.enum(["snyk", "agent", "baseline"]),
  /** The configuration the site is about; drawn in Hot Pink. Exactly one. */
  highlight: z.boolean(),
  /** Provenance: the harness report this configuration is computed from. */
  run: z.object({
    /** Harness id in the benchmark repository (`--harness`). */
    harness: nonEmpty,
    /** Report folder in the benchmark repository. */
    report: nonEmpty,
    harnessRevision: nonEmpty,
    /** Build of the Snyk CLI the run used. */
    cliBuild: nonEmpty,
    /** When the harness wrote the report. */
    generatedAt: nonEmpty,
  }),
  attempts: count,
  repos: count,
  vulnsFixable: count,
  vulnsCleared: count,
  passed: count,
  /** Attempts whose project still works: dependencies, build and tests pass. */
  green: count,
  /** Attempts passing each gate on its own. */
  gates: z.object({ depsResolve: count, vulnsFixed: count, cleanBuild: count, testsPass: count }),
  values: z.record(key, rate),
  /** PASS rate averaged per repository (macro). */
  macro: rate,
  /** Attempts surviving each entry of `flowSteps`, in order. */
  flow: z.array(count),
  /** Upgrades and PASSes by the size of the recommended version jump. */
  jumps: z.array(z.object({ id: key, attempts: count, passed: count })),
  ecosystems: z.array(ecosystemResultSchema),
  breakdowns: z.record(key, z.array(breakdownCategorySchema)),
  failures: z.object({
    reasons: z.record(key, count),
    categories: z.array(
      z.object({
        stage: z.enum(["deps", "build", "tests"]),
        label: nonEmpty,
        count,
      }),
    ),
  }),
  cost: z.object({
    method: z.enum(["list-price-estimate", "tool-reported"]),
    perAttempt: percentilesSchema,
    total: z.number().nonnegative(),
  }),
  latencySeconds: percentilesSchema,
  tokens: z.object({
    input: count,
    output: count,
    meanInput: count,
    meanOutput: count,
  }),
  quality: z.object({
    newVulns: severityCountsSchema,
    newVulnAttempts: count,
    remaining: severityCountsSchema,
    /** Of the remaining, vulnerabilities moved onto a new direct dependency. */
    moved: count,
    /** Of the remaining, vulnerabilities only a failed rescan reports. */
    remainingUnverified: count,
    testsModified: count,
    unrelatedBumps: count,
    claimedNotFixed: count,
    rescanFailed: count,
    turnCapped: count,
    timedOut: count,
    snykPolicyModified: count,
    harnessErrors: count,
  }),
});

/**
 * The non-agentic baseline (the paper's package manager bump). It ran outside
 * the harness reports, so it carries only what the paper reports for it.
 */
export const baselineSchema = z.object({
  id,
  label: nonEmpty,
  subtitle: nonEmpty,
  description: nonEmpty,
  runDate: z.iso.date(),
  attempts: count,
  repos: count,
  vulnsFixable: count,
  vulnsCleared: count,
  passed: count,
  green: count,
  gates: z.object({ depsResolve: count, vulnsFixed: count, cleanBuild: count, testsPass: count }),
  values: z.record(key, rate),
  macro: rate,
  flow: z.array(count),
  /** Upgrades and PASSes by the size of the recommended version jump (paper Figure 5). */
  jumps: z.array(z.object({ id: key, attempts: count, passed: count })),
  /**
   * Share of fixable vulnerabilities fixed by passing upgrades (paper Figure 6),
   * for the dimensions the paper reports, to whole percent; no fix rate.
   */
  breakdowns: z.record(key, z.array(z.object({ label: nonEmpty, n: count, passRate: rate }))),
});

const comparisonDimensionSchema = z.object({
  id,
  label: nonEmpty,
  note: nonEmpty,
  categories: z.array(nonEmpty).min(1),
  production: z.array(percent),
  benchmark: z.array(percent),
  /** Decimal places each series is shown with: [production, benchmark]. */
  decimals: z.tuple([z.number().int().min(0).max(2), z.number().int().min(0).max(2)]),
});

/** P10, P25, median, P75, P90. */
const boxSchema = z.tuple([z.number(), z.number(), z.number(), z.number(), z.number()]);

export const benchmarkSchema = z
  .object({
    release: z.object({
      name: nonEmpty,
      shortName: nonEmpty,
      datasetVersion: nonEmpty,
      /** "draft" shows a review banner and marks every page noindex. */
      status: z.enum(["draft", "published"]),
      publishedAt: z.iso.date().nullable(),
      runDate: z.iso.date(),
    }),
    /** Hero headline: `lead` in white, `keyword` in the Brand Gradient. */
    tagline: z.object({ lead: nonEmpty, keyword: nonEmpty }),
    researchQuestion: nonEmpty,
    studyLabel: nonEmpty,
    summary: nonEmpty,
    paper: z.object({
      title: nonEmpty,
      authors: z.array(z.object({ name: nonEmpty, affiliations: z.array(nonEmpty).min(1) })).min(1),
      date: z.iso.date(),
    }),
    links: z.object({
      paper: optionalUrl,
      publication: optionalUrl,
      github: optionalUrl,
      harness: optionalUrl,
    }),
    scope: z
      .array(z.object({ value: z.number().nonnegative(), label: nonEmpty }))
      .min(2)
      .max(4),
    /** Hero numeral: the highlighted configuration's value for `metric`. */
    headline: z.object({ metric: key, label: nonEmpty, caption: nonEmpty }),
    highlights: z
      .array(
        z.object({
          value: nonEmpty,
          label: nonEmpty,
          href: nonEmpty,
          tone: z.enum(["strong", "contrast"]),
        }),
      )
      .max(3),
    findings: z.array(
      z.object({
        title: nonEmpty,
        summary: nonEmpty,
        caveat: nonEmpty,
        href: nonEmpty,
      }),
    ),
    /** The three phases of the pipeline (paper Figure 3). */
    methodology: z.array(
      z.object({ title: nonEmpty, when: nonEmpty, text: nonEmpty, steps: z.array(nonEmpty).min(1) }),
    ),
    model: z.object({ name: nonEmpty, id: nonEmpty, provider: nonEmpty, claudeCodeVersion: nonEmpty }),
    budgets: z.object({ turnsPerUpgrade: count, timeoutMinutesPerAttempt: count, turns: nonEmpty }),
    /** List prices used for estimated (not tool-reported) costs. */
    pricing: z.object({
      inputPerMillion: z.number().positive(),
      outputPerMillion: z.number().positive(),
    }),
    /** Snyk Open Source production context (paper section 3.1). */
    production: z.object({
      period: nonEmpty,
      organisations: count,
      issueProjectPairs: count,
      fixedVersionShare: percent,
      fixPathShare: percent,
      openShare: percent,
      resolvedShare: percent,
      ignoredShare: percent,
    }),
    metrics: z.array(metricSchema).min(1),
    primaryMetric: key,
    flowSteps: z
      .array(z.object({ label: nonEmpty, dropLabel: nonEmpty.nullable() }))
      .min(2),
    ecosystems: z.array(z.object({ id, label: nonEmpty })).min(1),
    dimensions: z
      .array(z.object({ id: key, label: nonEmpty, note: nonEmpty.optional() }))
      .min(1),
    jumpCategories: z.array(z.object({ id: key, label: nonEmpty, note: nonEmpty.optional() })).min(1),
    failureReasons: z.array(z.object({ key, label: nonEmpty })).min(1),
    /** Paper Table 4: one root cause per failed attempt. */
    rootCauses: z.object({
      note: nonEmpty,
      groups: z.array(
        z.object({
          label: nonEmpty,
          description: nonEmpty,
          counts: perConfig,
          causes: z.array(z.object({ label: nonEmpty, counts: perConfig })),
        }),
      ),
    }),
    /** The agents matched on the same upgrades (paper section 5.1). */
    paired: z.object({
      comparisons: z.array(
        z.object({
          a: id,
          b: id,
          /** Upgrades only `a` passes, and only `b` passes. */
          aOnly: count,
          bOnly: count,
        }),
      ),
      /** Every upgrade, by the set of configurations that passed it. */
      agreement: z.array(z.object({ passedBy: z.array(id), count })),
    }),
    baseline: baselineSchema,
    /** Paper Table 3: each agent on the upgrades the baseline passes, and on the rest. */
    adviceSplit: z.object({
      solvable: count,
      other: count,
      agents: z.array(
        z.object({
          id,
          solvablePassed: count,
          otherPassed: count,
          /** Upgrades the baseline passes and the agent fails. */
          regressions: count,
          /** Upgrades the agent passes and the baseline fails. */
          gains: count,
        }),
      ),
    }),
    qualitySignals: z.array(
      z.object({
        key,
        label: nonEmpty,
        description: nonEmpty,
        attention: z.boolean(),
      }),
    ),
    configurations: z.array(configurationSchema).min(1).max(4),
    /** How the benchmark repositories were chosen (paper section 3). */
    selection: z.object({
      collected: count,
      collectedRepos: count,
      candidates: count,
      sources: z.array(z.object({ label: nonEmpty, count, description: nonEmpty })).min(1),
      /** Repositories left after each filter, in order, ending at the cases run. */
      funnel: z.array(z.object({ label: nonEmpty, count, dropLabel: nonEmpty.nullable() })).min(2),
      qualifying: z.object({ candidates: count, repos: count, byEcosystem: z.record(id, count) }),
      composition: z.object({
        byLanguage: z.array(z.object({ label: nonEmpty, count })),
        medianVulns: count,
        vulnRange: z.tuple([count, count]),
        medianTests: count,
        popular: count,
      }),
      selectionNote: nonEmpty,
      excludedReason: nonEmpty,
    }),
    /** Benchmark distribution against Snyk production data, in percent (paper Figure 2). */
    representativeness: z.object({
      source: nonEmpty,
      dimensions: z.array(comparisonDimensionSchema).min(1),
      perProject: z.object({
        label: nonEmpty,
        note: nonEmpty,
        groups: z.array(z.object({ label: nonEmpty, production: boxSchema, benchmark: boxSchema })).min(1),
      }),
      deviations: z.array(nonEmpty),
    }),
    /** Paper Table 1: the checks each benchmark uses to score an attempt. */
    relatedWork: z.object({
      columns: z.array(nonEmpty).min(1),
      rows: z.array(
        z.object({
          name: nonEmpty,
          ecosystems: nonEmpty,
          size: nonEmpty,
          trigger: nonEmpty,
          marks: z.array(z.enum(["full", "partial", "none"])),
          note: nonEmpty.optional(),
          highlight: z.boolean().optional(),
        }),
      ),
      note: nonEmpty,
    }),
    citation: z
      .object({
        bibtexKey: nonEmpty,
        title: nonEmpty,
        authors: z.array(nonEmpty).min(1),
        year: z.number().int(),
        url: optionalUrl,
      })
      .nullable(),
  })
  .superRefine((data, ctx) => {
    const issue = (path: (string | number)[], message: string) =>
      ctx.addIssue({ code: "custom", path, message });
    const close = (a: number, b: number) => Math.abs(a - b) < 5e-6;

    const metricKeys = new Set(data.metrics.map((m) => m.key));
    const ecosystemIds = new Set(data.ecosystems.map((e) => e.id));
    const dimensionIds = new Set(data.dimensions.map((d) => d.id));
    const jumpIds = data.jumpCategories.map((j) => j.id);
    const reasonKeys = new Set(data.failureReasons.map((r) => r.key));
    const configIds = data.configurations.map((c) => c.id);
    const byId = new Map(data.configurations.map((c) => [c.id, c]));

    for (const [path, k] of [
      [["primaryMetric"], data.primaryMetric],
      [["headline", "metric"], data.headline.metric],
    ] as const) {
      if (!metricKeys.has(k)) issue([...path], `Unknown metric "${k}"`);
    }
    if (data.metrics.filter((m) => m.kind === "verdict").length !== 1) {
      issue(["metrics"], "Exactly one metric must be the verdict");
    }
    for (const k of gateKeys) {
      if (!data.metrics.some((m) => m.key === k && m.kind === "gate")) issue(["metrics"], `Missing gate "${k}"`);
    }

    if (data.configurations.filter((c) => c.highlight).length !== 1) {
      issue(["configurations"], "Exactly one configuration must be highlighted");
    }

    data.configurations.forEach((c, i) => {
      const at = (...rest: (string | number)[]) => ["configurations", i, ...rest];

      for (const k of metricKeys) {
        if (!(k in c.values)) issue(at("values", k), `"${c.id}" is missing metric "${k}"`);
      }

      // Every rate must be its counts divided out.
      const expected: Record<string, number> = {
        ...Object.fromEntries(gateKeys.map((k) => [k, c.gates[k] / c.attempts])),
        projectWorks: c.green / c.attempts,
        allGates: c.passed / c.attempts,
        instancesFixed: c.vulnsCleared / c.vulnsFixable,
      };
      for (const [k, v] of Object.entries(expected)) {
        if (k in c.values && !close(c.values[k]!, v)) issue(at("values", k), `"${k}" disagrees with its counts`);
      }

      // Gate flow: one count per step, starting at all attempts, never growing,
      // ending at the attempts that passed.
      if (c.flow.length !== data.flowSteps.length) {
        issue(at("flow"), `Expected ${data.flowSteps.length} flow counts`);
      }
      if (c.flow[0] !== c.attempts) issue(at("flow", 0), "First flow count must equal attempts");
      if (c.flow[c.flow.length - 1] !== c.passed) {
        issue(at("flow"), "Last flow count must equal passed");
      }
      c.flow.forEach((n, step) => {
        const previous = c.flow[step - 1];
        if (previous !== undefined && n > previous) {
          issue(at("flow", step), "Flow counts must not increase");
        }
      });
      if (c.flow[1] !== c.gates.depsResolve) issue(at("flow", 1), "Second flow count must equal the dependency gate");

      // Version jumps partition the upgrades and the PASSes.
      if (c.jumps.map((j) => j.id).join() !== jumpIds.join()) issue(at("jumps"), "Jumps must follow jumpCategories");
      const jumpAttempts = c.jumps.reduce((t, j) => t + j.attempts, 0);
      const jumpPassed = c.jumps.reduce((t, j) => t + j.passed, 0);
      if (jumpAttempts !== c.attempts || jumpPassed !== c.passed) {
        issue(at("jumps"), `Jumps cover ${jumpPassed} of ${jumpAttempts}, expected ${c.passed} of ${c.attempts}`);
      }

      // Ecosystem rows must add up to the configuration totals.
      const sum = (pick: (e: (typeof c.ecosystems)[number]) => number) =>
        c.ecosystems.reduce((total, e) => total + pick(e), 0);
      c.ecosystems.forEach((e, j) => {
        if (!ecosystemIds.has(e.id)) issue(at("ecosystems", j, "id"), `Unknown ecosystem "${e.id}"`);
      });
      for (const [field, total] of [
        ["attempts", c.attempts],
        ["repos", c.repos],
        ["passed", c.passed],
        ["vulnsCleared", c.vulnsCleared],
        ["vulnsFixable", c.vulnsFixable],
      ] as const) {
        const actual = sum((e) => e[field]);
        if (actual !== total) {
          issue(at("ecosystems"), `Ecosystem ${field} sum to ${actual}, expected ${total}`);
        }
      }

      // Each breakdown dimension partitions the fixable vulnerabilities.
      for (const [dim, categories] of Object.entries(c.breakdowns)) {
        if (!dimensionIds.has(dim)) issue(at("breakdowns", dim), `Unknown dimension "${dim}"`);
        const n = categories.reduce((total, cat) => total + cat.n, 0);
        if (n !== c.vulnsFixable) {
          issue(at("breakdowns", dim), `"${dim}" covers ${n} vulnerabilities, expected ${c.vulnsFixable}`);
        }
      }

      for (const k of Object.keys(c.failures.reasons)) {
        if (!reasonKeys.has(k)) issue(at("failures", "reasons", k), `Unknown failure reason "${k}"`);
      }

      for (const signal of data.qualitySignals) {
        if (!(signal.key in c.quality)) {
          issue(at("quality", signal.key), `"${c.id}" is missing quality signal "${signal.key}"`);
        }
      }

      const remaining = c.quality.remaining.reduce((a, b) => a + b, 0);
      if (remaining !== c.vulnsFixable - c.vulnsCleared) {
        issue(at("quality", "remaining"), "Remaining vulnerabilities must equal fixable minus cleared");
      }
      if (c.quality.moved + c.quality.remainingUnverified > remaining) {
        issue(at("quality"), "Moved and unverified vulnerabilities are subsets of the remaining");
      }

      if (c.green < c.passed || c.green > c.attempts) {
        issue(at("green"), "Green attempts must lie between passed and attempts");
      }
    });

    // Root causes: one per failed attempt, causes adding up to their group.
    const failures = new Map<string, number>([
      ...data.configurations.map((c) => [c.id, c.attempts - c.passed] as const),
      [data.baseline.id, data.baseline.attempts - data.baseline.passed],
    ]);
    for (const [cid, failed] of failures) {
      let total = 0;
      data.rootCauses.groups.forEach((g, gi) => {
        const n = g.counts[cid] ?? 0;
        total += n;
        if (g.causes.length === 0) return;
        const causes = g.causes.reduce((t, cause) => t + (cause.counts[cid] ?? 0), 0);
        if (causes !== n) issue(["rootCauses", "groups", gi], `"${g.label}" causes for "${cid}" sum to ${causes}, expected ${n}`);
      });
      if (total !== failed) {
        issue(["rootCauses"], `Root causes for "${cid}" sum to ${total}, expected ${failed} failures`);
      }
    }

    // Baseline: rates equal their counts, the flow never grows, its jumps
    // partition the same upgrades as the agents', and its breakdown buckets
    // are the agents' buckets.
    const b = data.baseline;
    const at = (...rest: (string | number)[]) => ["baseline", ...rest];
    const expectedBaseline: Record<string, number> = {
      ...Object.fromEntries(gateKeys.map((k) => [k, b.gates[k] / b.attempts])),
      projectWorks: b.green / b.attempts,
      allGates: b.passed / b.attempts,
      instancesFixed: b.vulnsCleared / b.vulnsFixable,
    };
    for (const k of metricKeys) {
      if (!(k in b.values)) issue(at("values", k), `Baseline is missing metric "${k}"`);
      else if (k in expectedBaseline && !close(b.values[k]!, expectedBaseline[k]!)) {
        issue(at("values", k), `Baseline "${k}" disagrees with its counts`);
      }
    }
    if (b.flow.length !== data.flowSteps.length || b.flow[0] !== b.attempts || b.flow.at(-1) !== b.passed) {
      issue(at("flow"), "Baseline flow must run from attempts to passed, one count per step");
    }
    if (b.flow[1] !== b.gates.depsResolve) issue(at("flow", 1), "Second flow count must equal the dependency gate");
    b.flow.forEach((v, i) => {
      if (i > 0 && v > b.flow[i - 1]!) issue(at("flow", i), "Flow counts must not increase");
    });
    if (b.jumps.map((j) => j.id).join() !== jumpIds.join()) issue(at("jumps"), "Jumps must follow jumpCategories");
    const bumpJumpAttempts = b.jumps.reduce((t, j) => t + j.attempts, 0);
    const bumpJumpPassed = b.jumps.reduce((t, j) => t + j.passed, 0);
    if (bumpJumpAttempts !== b.attempts || bumpJumpPassed !== b.passed) {
      issue(at("jumps"), `Jumps cover ${bumpJumpPassed} of ${bumpJumpAttempts}, expected ${b.passed} of ${b.attempts}`);
    }
    const reference = data.configurations[0];
    b.jumps.forEach((j, i) => {
      const agent = reference?.jumps.find((x) => x.id === j.id);
      if (agent && agent.attempts !== j.attempts) issue(at("jumps", i), `"${j.id}" has ${j.attempts} upgrades, the agents ${agent.attempts}`);
    });
    for (const [dim, categories] of Object.entries(b.breakdowns)) {
      if (!dimensionIds.has(dim)) issue(at("breakdowns", dim), `Unknown dimension "${dim}"`);
      categories.forEach((cat, i) => {
        const agent = reference?.breakdowns[dim]?.find((x) => x.label === cat.label);
        if (!agent || agent.n !== cat.n) issue(at("breakdowns", dim, i), `"${cat.label}" must match an agent bucket of the same size`);
      });
    }

    // Advice split: the baseline's PASSes are the solvable side, and each
    // agent's two sides add up to its PASS count.
    const split = data.adviceSplit;
    if (split.solvable !== b.passed || split.solvable + split.other !== b.attempts) {
      issue(["adviceSplit"], "The split must be the baseline's PASSes and the rest");
    }
    split.agents.forEach((a, i) => {
      const c = byId.get(a.id);
      if (!c) return issue(["adviceSplit", "agents", i], `Unknown configuration "${a.id}"`);
      if (a.solvablePassed + a.otherPassed !== c.passed) {
        issue(["adviceSplit", "agents", i], `"${a.id}" split sums to ${a.solvablePassed + a.otherPassed}, expected ${c.passed}`);
      }
      if (a.regressions !== split.solvable - a.solvablePassed) {
        issue(["adviceSplit", "agents", i], "Regressions must be the solvable upgrades the agent fails");
      }
      if (a.gains !== a.otherPassed) issue(["adviceSplit", "agents", i], "Gains must be the other upgrades the agent passes");
    });

    // Paired comparisons: the agreement pattern covers every upgrade once,
    // reproduces each configuration's PASS count and every discordant count.
    const { agreement, comparisons } = data.paired;
    const attempts = data.configurations[0]?.attempts ?? 0;
    const covered = agreement.reduce((t, a) => t + a.count, 0);
    if (covered !== attempts) issue(["paired", "agreement"], `Agreement covers ${covered} upgrades, expected ${attempts}`);
    const passedBy = (pred: (ids: string[]) => boolean) =>
      agreement.filter((a) => pred(a.passedBy)).reduce((t, a) => t + a.count, 0);
    for (const cid of configIds) {
      const n = passedBy((ids) => ids.includes(cid));
      if (n !== byId.get(cid)!.passed) issue(["paired", "agreement"], `Agreement gives "${cid}" ${n} PASSes`);
    }
    comparisons.forEach((cmp, i) => {
      if (!byId.has(cmp.a) || !byId.has(cmp.b)) issue(["paired", "comparisons", i], "Unknown configuration");
      const aOnly = passedBy((ids) => ids.includes(cmp.a) && !ids.includes(cmp.b));
      const bOnly = passedBy((ids) => ids.includes(cmp.b) && !ids.includes(cmp.a));
      if (aOnly !== cmp.aOnly || bOnly !== cmp.bOnly) {
        issue(["paired", "comparisons", i], `Discordant counts disagree with the agreement pattern (${aOnly}/${bOnly})`);
      }
    });

    // Selection: sources add up to the candidates, every filter only removes
    // repositories, and the funnel ends at the repositories actually run.
    const { selection } = data;
    const sourced = selection.sources.reduce((total, s) => total + s.count, 0);
    if (sourced !== selection.candidates) {
      issue(["selection", "sources"], `Sources sum to ${sourced}, expected ${selection.candidates}`);
    }
    const funnel = selection.funnel.map((f) => f.count);
    if (funnel[0] !== selection.candidates) {
      issue(["selection", "funnel", 0], "Funnel must start at the candidates");
    }
    funnel.forEach((n, step) => {
      const previous = funnel[step - 1];
      if (previous !== undefined && n > previous) {
        issue(["selection", "funnel", step], "Funnel counts must not increase");
      }
    });
    const cases = funnel[funnel.length - 1];
    data.configurations.forEach((c, i) => {
      if (c.repos !== cases) issue(["configurations", i, "repos"], `Expected ${cases} repositories`);
    });
    if (funnel[funnel.length - 2] !== selection.qualifying.candidates) {
      issue(["selection", "qualifying"], "Qualifying candidates must equal the step before selection");
    }
    const languages = selection.composition.byLanguage.reduce((t, l) => t + l.count, 0);
    if (languages !== cases) issue(["selection", "composition"], `Languages sum to ${languages}, expected ${cases}`);

    data.representativeness.dimensions.forEach((d, i) => {
      for (const series of ["production", "benchmark"] as const) {
        if (d[series].length !== d.categories.length) {
          issue(["representativeness", "dimensions", i, series], `Expected ${d.categories.length} values`);
        }
      }
    });

    data.relatedWork.rows.forEach((row, i) => {
      if (row.marks.length !== data.relatedWork.columns.length) {
        issue(["relatedWork", "rows", i], `Expected ${data.relatedWork.columns.length} marks`);
      }
    });
  });

export type Benchmark = z.infer<typeof benchmarkSchema>;
export type Metric = z.infer<typeof metricSchema>;
export type Configuration = z.infer<typeof configurationSchema>;
export type Baseline = z.infer<typeof baselineSchema>;
export type EcosystemResult = z.infer<typeof ecosystemResultSchema>;
export type BreakdownCategory = z.infer<typeof breakdownCategorySchema>;
export type FlowStep = Benchmark["flowSteps"][number];
export type Dimension = Benchmark["dimensions"][number];
export type RepresentativenessDimension = Benchmark["representativeness"]["dimensions"][number];
