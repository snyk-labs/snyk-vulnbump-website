#!/usr/bin/env node
/*
 * Renders the Open Graph / Twitter card (public/brand/social-<hash>.png,
 * 1200 x 630) from src/data/benchmark.json, so the card matches the site.
 *
 *   npm run social
 *
 * It writes a self-contained HTML card (fonts and logos inlined) and
 * screenshots it with a local Chromium-based browser in headless mode. Set
 * CHROME_PATH to pick the browser; otherwise common install paths are tried.
 * The file name fingerprints the card's content (src/lib/social.ts); the build
 * fails when it is stale, so re-run this after the headline numbers change
 * and commit the new PNG.
 */
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { SOCIAL_HEIGHT as HEIGHT, SOCIAL_WIDTH as WIDTH, socialCard, socialImagePath } from "../src/lib/social.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const at = (path) => join(root, path);
const card = socialCard(JSON.parse(readFileSync(at("src/data/benchmark.json"), "utf8")));
const imagePath = socialImagePath(card);
const OUT = at(`public${imagePath}`);

const dataUrl = (path, type) => `data:${type};base64,${readFileSync(at(path)).toString("base64")}`;
const escape = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const words = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8" />
<style>
  @font-face { font-family: "Geist"; src: url(${dataUrl("node_modules/@fontsource-variable/geist/files/geist-latin-wght-normal.woff2", "font/woff2")}) format("woff2"); font-weight: 100 900; }
  @font-face { font-family: "Geist Mono"; src: url(${dataUrl("node_modules/@fontsource-variable/geist-mono/files/geist-mono-latin-wght-normal.woff2", "font/woff2")}) format("woff2"); font-weight: 100 900; }
  :root { --paper: #0b0613; --ink: #ffffff; --ink-soft: #c9bfd8; --ink-faint: #a294b8;
    --rule: rgba(255, 255, 255, 0.1); --rule-strong: rgba(255, 255, 255, 0.2); --pass: #8f3ce8; --pass-text: #c481f3; --pass-tint: rgba(143, 60, 232, 0.12); }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: ${WIDTH}px; height: ${HEIGHT}px; overflow: hidden; background: var(--paper); }
  body { display: grid; grid-template-rows: 1fr 76px; color: var(--ink); font-family: "Geist", sans-serif; }
  .main { padding: 30px 56px 12px; }
  .eyebrow { display: flex; gap: 12px; align-items: center; color: var(--pass-text); font: 500 16px/1 "Geist Mono", monospace; letter-spacing: 0.14em; text-transform: uppercase; }
  .eyebrow img { width: 26px; height: 26px; }
  h1 { margin-top: 14px; font-size: 48px; font-weight: 600; letter-spacing: -0.035em; line-height: 1; }
  table { width: 100%; margin-top: 14px; border-collapse: separate; border-spacing: 0; color: var(--ink-soft); }
  th, td { padding: 0 12px; height: 50px; border-bottom: 1px solid var(--rule); vertical-align: middle; }
  th.stub, tbody th { width: 330px; text-align: left; }
  tbody th { color: var(--ink); font-size: 20px; font-weight: 400; }
  .num { text-align: right; }
  thead th { height: 62px; border-bottom: 1px solid var(--rule-strong); color: var(--ink-soft); font-size: 17px; font-weight: 600; line-height: 1.2; vertical-align: bottom; padding-bottom: 8px; }
  thead small { display: block; color: var(--ink-faint); font-size: 12px; font-weight: 400; }
  td { font: 400 22px/1 "Geist Mono", monospace; font-variant-numeric: tabular-nums; white-space: nowrap; }
  td.is-baseline, th.is-baseline { color: var(--ink-faint); }
  .cell { display: inline-block; width: 128px; padding: 7px 14px; border-radius: 8px; text-align: right; }
  .cell small { display: block; margin-top: 3px; color: var(--ink-faint); font-size: 12px; }
  .cell.is-best { background: var(--pass); color: #ffffff; font-weight: 700; }
  .cell.is-best small { color: rgba(255, 255, 255, 0.85); }
  tr.has-counts th, tr.has-counts td { height: 72px; }
  tr.is-verdict th, tr.is-verdict td:not(.is-featured) { border-top: 1px solid var(--rule-strong); }
  tr.is-last th, tr.is-last td:not(.is-featured) { border-bottom: 2px solid var(--rule-strong); }
  td.is-featured .cell:not(.is-best) { color: #ffffff; }
  th.is-featured, td.is-featured { background: var(--pass-tint); border-left: 2px solid var(--pass); border-right: 2px solid var(--pass); }
  thead th.is-featured { border-top: 2px solid var(--pass); border-radius: 12px 12px 0 0; color: #ffffff; }
  .is-last td.is-featured { border-bottom: 2px solid var(--pass); border-radius: 0 0 12px 12px; }
  .footer { display: flex; gap: 36px; align-items: center; padding: 0 56px; border-top: 1px solid var(--rule); background: #000000; }
  .footer img { width: 96px; height: auto; flex: none; }
  .meta { display: grid; gap: 6px; color: var(--ink-faint); font: 400 14px/1.3 "Geist Mono", monospace; }
  .meta span:first-child { color: var(--ink-soft); }
</style></head>
<body>
  <section class="main">
    <p class="eyebrow"><img src="${dataUrl("public/brand/logo-mark.svg", "image/svg+xml")}" alt="" />${escape(card.eyebrow)} · Key results</p>
    <h1>${escape(card.title)}</h1>
    <table>
      <thead><tr><th class="stub"></th>${card.columns
        .map(
          (c) =>
            `<th class="num${c.isFeatured ? " is-featured" : ""}${c.isBaseline ? " is-baseline" : ""}">${escape(c.label)}${c.isBaseline ? "<small>non-agentic baseline</small>" : ""}</th>`,
        )
        .join("")}</tr></thead>
      <tbody>${card.rows
        .map(
          (row, r) => `<tr class="${row.cells.some((c) => c.counts) ? "has-counts " : ""}${row.isVerdict ? "is-verdict" : ""}${r === card.rows.length - 1 ? " is-last" : ""}"><th>${escape(row.label)}</th>${row.cells
            .map(
              (cell, i) =>
                `<td class="num${card.columns[i].isFeatured ? " is-featured" : ""}${card.columns[i].isBaseline ? " is-baseline" : ""}"><span class="cell${cell.isBest ? " is-best" : ""}">${cell.value}${cell.counts ? `<small>${cell.counts}</small>` : ""}</span></td>`,
            )
            .join("")}</tr>`,
        )
        .join("")}</tbody>
    </table>
  </section>
  <footer class="footer">
    <img src="${dataUrl("scripts/social/snyk-logo-white.png", "image/png")}" alt="Snyk" />
    <div class="meta">
      <span>Dataset ${escape(card.datasetVersion)} · ${card.attempts} upgrades in ${card.repos} real repositories across ${words[card.packageManagers] ?? card.packageManagers} package managers</span>
      <span>Same model for all agents: ${escape(card.model)} · Snyk, ${escape(card.paperDate)} · filled cell = best agent per row</span>
    </div>
  </footer>
</body></html>`;

function findBrowser() {
  const candidates = [
    process.env.CHROME_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].filter(Boolean);
  const found = candidates.find((p) => existsSync(p));
  if (!found) throw new Error("No Chromium-based browser found. Set CHROME_PATH to one.");
  return found;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Waits for the browser to report its DevTools port, then returns the page's socket URL. */
async function pageSocket(profile) {
  const portFile = join(profile, "DevToolsActivePort");
  for (let i = 0; i < 100; i++) {
    if (existsSync(portFile)) {
      const port = readFileSync(portFile, "utf8").split("\n")[0];
      const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      const target = targets.find((t) => t.type === "page");
      if (target) return target.webSocketDebuggerUrl;
    }
    await sleep(200);
  }
  throw new Error("The browser did not open a DevTools port.");
}

/** A minimal DevTools protocol client: send(method, params) and wait for an event. */
function connect(url) {
  const socket = new WebSocket(url);
  let id = 0;
  const pending = new Map();
  const waiters = [];
  socket.addEventListener("message", ({ data }) => {
    const msg = JSON.parse(data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(`${msg.error.message} (${msg.error.code})`));
      else resolve(msg.result);
    } else if (msg.method) {
      for (const w of waiters.filter((x) => x.method === msg.method)) {
        waiters.splice(waiters.indexOf(w), 1);
        w.resolve(msg.params);
      }
    }
  });
  const ready = new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", () => reject(new Error("Could not connect to the browser.")), { once: true });
  });
  return {
    ready,
    send: (method, params = {}) =>
      new Promise((resolve, reject) => {
        pending.set(++id, { resolve, reject });
        socket.send(JSON.stringify({ id, method, params }));
      }),
    once: (method) => new Promise((resolve) => waiters.push({ method, resolve })),
    close: () => socket.close(),
  };
}

async function render(pagePath, profile) {
  // --screenshot can hang in headless mode on macOS, so drive the page over DevTools instead.
  const browser = spawn(
    findBrowser(),
    [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      "--no-first-run",
      "--no-default-browser-check",
      "--remote-debugging-port=0",
      `--user-data-dir=${profile}`,
      // Taller than the card: a window shorter than the emulated viewport repeats its top.
      `--window-size=${WIDTH},${HEIGHT * 2}`,
      "about:blank",
    ],
    { stdio: "ignore" },
  );
  const timer = setTimeout(() => browser.kill("SIGKILL"), 60_000);
  try {
    const cdp = connect(await pageSocket(profile));
    await cdp.ready;
    await cdp.send("Emulation.setDeviceMetricsOverride", { width: WIDTH, height: HEIGHT, deviceScaleFactor: 1, mobile: false });
    await cdp.send("Page.enable");
    const loaded = cdp.once("Page.loadEventFired");
    await cdp.send("Page.navigate", { url: pathToFileURL(pagePath).href });
    await loaded;
    await cdp.send("Runtime.evaluate", { expression: "document.fonts.ready.then(() => true)", awaitPromise: true });
    const { result } = await cdp.send("Runtime.evaluate", { expression: "`${innerWidth}x${innerHeight}`" });
    if (result.value !== `${WIDTH}x${HEIGHT}`) console.warn(`Viewport is ${result.value}, expected ${WIDTH}x${HEIGHT}`);
    const { data: png } = await cdp.send("Page.captureScreenshot", {
      format: "png",
      clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT, scale: 1 },
      captureBeyondViewport: true,
    });
    writeFileSync(OUT, Buffer.from(png, "base64"));
    cdp.close();
  } finally {
    clearTimeout(timer);
    browser.kill();
  }
}

const work = mkdtempSync(join(tmpdir(), "vulnbump-social-"));
try {
  const page = join(work, "card.html");
  writeFileSync(page, html);
  await render(page, join(work, "profile"));
  // Keep only the current card: older fingerprints are stale.
  for (const name of readdirSync(at("public/brand"))) {
    if (/^social-[0-9a-f]+\.png$/.test(name) && `/brand/${name}` !== imagePath) rmSync(at(`public/brand/${name}`));
  }
  console.log(`Wrote ${OUT}`);
} finally {
  await sleep(500);
  rmSync(work, { recursive: true, force: true });
}
