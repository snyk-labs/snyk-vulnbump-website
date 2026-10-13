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
const pct = (x) => `${(x * 100).toFixed(1)}%`;
const words = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8" />
<style>
  @font-face { font-family: "Geist"; src: url(${dataUrl("node_modules/@fontsource-variable/geist/files/geist-latin-wght-normal.woff2", "font/woff2")}) format("woff2"); font-weight: 100 900; }
  @font-face { font-family: "Geist Mono"; src: url(${dataUrl("node_modules/@fontsource-variable/geist-mono/files/geist-mono-latin-wght-normal.woff2", "font/woff2")}) format("woff2"); font-weight: 100 900; }
  :root { --paper: #0b0613; --panel: #14091f; --ink: #ffffff; --ink-soft: #c9bfd8; --ink-faint: #a294b8;
    --rule: rgba(255, 255, 255, 0.1); --rule-strong: rgba(255, 255, 255, 0.2); --pass: #8f3ce8; --pass-text: #c481f3; --fail: #ff8904; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: ${WIDTH}px; height: ${HEIGHT}px; overflow: hidden; background: var(--paper); }
  body { display: grid; grid-template-rows: 1fr 104px; color: var(--ink); font-family: "Geist", sans-serif; }
  .main { display: grid; grid-template-columns: 1fr 470px; gap: 56px; padding: 60px 64px 44px; align-items: center; }
  .eyebrow { display: flex; gap: 14px; align-items: center; color: var(--pass-text); font: 500 18px/1 "Geist Mono", monospace; letter-spacing: 0.14em; text-transform: uppercase; }
  .eyebrow img { width: 30px; height: 30px; }
  h1 { margin-top: 30px; font-size: 92px; font-weight: 600; letter-spacing: -0.045em; line-height: 0.95; }
  h1 span { display: block; color: var(--pass-text); }
  .lede { max-width: 30ch; margin-top: 28px; color: var(--ink-soft); font-size: 25px; line-height: 1.4; }
  .card { padding: 30px 32px 28px; border: 1px solid var(--rule-strong); border-radius: 14px; background: var(--panel); }
  .card h2 { color: var(--ink-faint); font: 500 15px/1.3 "Geist Mono", monospace; letter-spacing: 0.1em; text-transform: uppercase; }
  .bars { display: grid; gap: 20px; margin-top: 24px; list-style: none; }
  .bar-head { display: flex; justify-content: space-between; align-items: baseline; gap: 16px; }
  .bar-label { color: var(--ink-soft); font-size: 19px; }
  .bar-label.is-highlight { color: var(--ink); font-weight: 600; }
  .bar-value { font: 500 22px/1 "Geist Mono", monospace; font-variant-numeric: tabular-nums; }
  .is-highlight + .bar-value { color: var(--pass-text); }
  .track { height: 14px; margin-top: 9px; overflow: hidden; border-radius: 3px; background: var(--fail); }
  .fill { display: block; height: 100%; }
  .track--baseline { background: color-mix(in srgb, var(--fail) 45%, var(--panel)); }
  .track--baseline .fill { border: 1.5px dashed var(--pass-text); background: var(--panel); }
  .card p { margin-top: 24px; color: var(--ink-faint); font: 400 14px/1.4 "Geist Mono", monospace; }
  .footer { display: flex; gap: 40px; align-items: center; padding: 0 64px; border-top: 1px solid var(--rule); background: #000000; }
  .footer img { width: 112px; height: auto; flex: none; }
  .meta { display: grid; gap: 8px; color: var(--ink-faint); font: 400 15px/1.3 "Geist Mono", monospace; }
  .meta span:first-child { color: var(--ink-soft); }
</style></head>
<body>
  <section class="main">
    <div>
      <p class="eyebrow"><img src="${dataUrl("public/brand/logo-mark.svg", "image/svg+xml")}" alt="" />${escape(card.eyebrow)}</p>
      <h1>${escape(card.lead)}<span>${escape(card.keyword)}</span></h1>
      <p class="lede">${escape(card.question)}</p>
    </div>
    <div class="card">
      <h2>${escape(card.chartTitle)}</h2>
      <ul class="bars">
        ${card.bars
          .map(
            (b) => `<li>
          <div class="bar-head"><span class="bar-label${b.highlight ? " is-highlight" : ""}">${escape(b.label)}</span><span class="bar-value">${pct(b.value)}</span></div>
          <div class="track${b.baseline ? " track--baseline" : ""}"><span class="fill" style="width: ${(b.value * 100).toFixed(2)}%;${
            b.baseline ? "" : ` background: color-mix(in srgb, var(--pass) ${b.shade * 100}%, var(--panel));`
          }"></span></div>
        </li>`,
          )
          .join("")}
      </ul>
      <p>Same model for every agent: ${escape(card.model)}</p>
    </div>
  </section>
  <footer class="footer">
    <img src="${dataUrl("scripts/social/snyk-logo-white.png", "image/png")}" alt="Snyk" />
    <div class="meta">
      <span>Dataset ${escape(card.datasetVersion)} · ${card.attempts} upgrades in ${card.repos} real repositories across ${words[card.packageManagers] ?? card.packageManagers} package managers</span>
      <span>Source: the VulnBump paper · Snyk, ${escape(card.paperDate)} · bars: purple passed, orange failed</span>
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
