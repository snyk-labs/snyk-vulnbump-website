import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import { defineConfig } from "astro/config";

// Canonical URLs and the sitemap need an absolute origin. Set SITE_URL once the
// production domain is chosen; until then Vercel's production hostname is used.
const site =
  process.env.SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:4321");

export default defineConfig({
  site,
  output: "static",
  // Pairs with `cleanUrls` and `trailingSlash: false` in vercel.json.
  trailingSlash: "never",
  build: {
    format: "file",
  },
  integrations: [react(), sitemap()],
  vite: {
    build: {
      cssMinify: true,
    },
  },
});
