import { createHash } from "node:crypto";
import type { Benchmark } from "../data/schema";

/*
 * The Open Graph / Twitter card, shared by its generator (scripts/social-card.mjs)
 * and the page metadata. The image's file name carries a fingerprint of what
 * the card shows, so a change of numbers needs a regenerated card (the build
 * checks) and social crawlers fetch the new image instead of a cached one.
 *
 * Imported by Node directly, so local imports are type-only.
 */

export const SOCIAL_WIDTH = 1200;
export const SOCIAL_HEIGHT = 630;
/** Bump when the card's design changes, so its file name changes too. */
const DESIGN_VERSION = 3;

export interface SocialCell {
  /** "90.2%", or "100%" for a perfect rate. */
  value: string;
  /** The "(n/N)" line under PASS and instances fixed. */
  counts: string | null;
  isBest: boolean;
}

export interface SocialColumn {
  label: string;
  isBaseline: boolean;
  isFeatured: boolean;
}

export interface SocialRow {
  label: string;
  isVerdict: boolean;
  cells: SocialCell[];
}

const percent = (x: number) => (x === 1 ? "100%" : `${(x * 100).toFixed(1)}%`);
const integer = (n: number) => n.toLocaleString("en-US");

/**
 * What the card shows: the key results table from the home page, in its
 * column order (baseline, then the agents) with the highlighted agent last.
 */
export function socialCard(data: Benchmark) {
  const { configurations, baseline, release, model, scope, metrics, paper } = data;
  const entries = [
    { c: baseline, isBaseline: true, isFeatured: false },
    ...configurations.map((c) => ({ c, isBaseline: false, isFeatured: c.highlight })),
  ];
  const columns: SocialColumn[] = entries.map(({ c, isBaseline, isFeatured }) => ({
    label: c.label,
    isBaseline,
    isFeatured,
  }));
  const rows: SocialRow[] = metrics
    .filter((m) => m.key !== "projectWorks")
    .map((metric) => {
      const values = entries.map(({ c }) => c.values[metric.key] ?? 0);
      // Best compares the agents only; the baseline is a reference.
      const best = Math.max(...entries.flatMap((e, i) => (e.isBaseline ? [] : [Math.round(values[i]! * 1000)])));
      return {
        label: metric.label,
        isVerdict: metric.kind === "verdict",
        cells: entries.map(({ c, isBaseline }, i) => ({
          value: percent(values[i]!),
          counts:
            metric.key === "allGates"
              ? `(${integer(c.passed)}/${integer(c.attempts)})`
              : metric.key === "instancesFixed"
                ? `(${integer(c.vulnsCleared)}/${integer(c.vulnsFixable)})`
                : null,
          isBest: !isBaseline && Math.round(values[i]! * 1000) === best,
        })),
      };
    });
  // "Snyk VulnBump 1.0" becomes "Snyk VulnBump Benchmark 1.0".
  const product = release.name.replace(release.shortName, "").trim();
  return {
    eyebrow: `${product} Benchmark ${release.shortName}`,
    title: "Four gates, one verdict",
    columns,
    rows,
    model: model.name,
    datasetVersion: release.datasetVersion,
    attempts: configurations[0]?.attempts ?? 0,
    repos: configurations[0]?.repos ?? 0,
    packageManagers: scope.find((s) => s.label === "package managers")?.value ?? 0,
    paperDate: new Date(`${paper.date}T00:00:00Z`).toLocaleDateString("en-GB", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }),
  };
}

export type SocialCard = ReturnType<typeof socialCard>;

/** Site-relative path of the card's PNG under public/. */
export function socialImagePath(card: SocialCard): string {
  const hash = createHash("sha256")
    .update(JSON.stringify({ design: DESIGN_VERSION, card }))
    .digest("hex")
    .slice(0, 10);
  return `/brand/social-${hash}.png`;
}

/** Alt text that says what the image shows. */
export function socialAlt(card: SocialCard): string {
  const pass = card.rows.find((r) => r.isVerdict);
  const rates = pass ? card.columns.map((c, i) => `${c.label} ${pass.cells[i]!.value}`).join(", ") : "";
  return `${card.eyebrow} key results: ${card.title}. ${pass?.label ?? "All gates pass"}: ${rates}.`;
}
