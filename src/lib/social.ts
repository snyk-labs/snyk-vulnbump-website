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
const DESIGN_VERSION = 1;

export interface SocialBar {
  label: string;
  value: number;
  /** Mix of the PASS purple into the panel, as on the site; absent for the baseline. */
  shade?: number;
  highlight: boolean;
  baseline: boolean;
}

/** What the card shows, in the site's display order: highlighted agent, other agents, baseline. */
export function socialCard(data: Benchmark) {
  const { configurations, baseline, release, model, scope, tagline, researchQuestion, paper } = data;
  const agents = [
    ...configurations.filter((c) => c.highlight),
    ...configurations.filter((c) => !c.highlight).reverse(),
  ];
  const shades = [1, 0.62, 0.34];
  const bars: SocialBar[] = [
    ...agents.map((c, i) => ({
      label: c.label,
      value: c.values.allGates ?? 0,
      shade: shades[i] ?? shades.at(-1)!,
      highlight: c.highlight,
      baseline: false,
    })),
    { label: baseline.label, value: baseline.values.allGates ?? 0, highlight: false, baseline: true },
  ];
  // "Snyk VulnBump 1.0" becomes "Snyk VulnBump Benchmark 1.0".
  const product = release.name.replace(release.shortName, "").trim();
  return {
    eyebrow: `${product} Benchmark ${release.shortName}`,
    lead: tagline.lead,
    keyword: tagline.keyword,
    question: researchQuestion,
    chartTitle: "Dependency upgrades pass rate",
    bars,
    model: model.name,
    // The card outlives the draft, so it shows the release version without a pre-release tag.
    datasetVersion: release.datasetVersion.split("-")[0]!,
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
  const rates = card.bars.map((b) => `${b.label} ${(b.value * 100).toFixed(1)}%`).join(", ");
  return `${card.eyebrow}: ${card.lead} ${card.keyword} ${card.chartTitle}: ${rates}.`;
}
