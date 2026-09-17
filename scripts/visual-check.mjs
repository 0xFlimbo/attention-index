/**
 * `pnpm check:visual` — the browser review pass for any batch that renders UI.
 *
 * Maintenance tool, never production runtime (same category as `enrich:twitter`
 * and `import:press`). It exists because this machine is small: 8 GB of RAM, and
 * an ad-hoc review that ran a build, a server and several browser contexts at
 * once once bugchecked it (`0x000000EF CRITICAL_PROCESS_DIED`, 2026-09-17).
 *
 * The rule that came out of that: **one thing at a time.**
 *
 *   1. debug   — code checks finish FIRST, in a separate command. This script
 *                refuses to build; it only uses a build that already exists.
 *   2. server  — started alone, and nothing else runs while it is up.
 *   3. screens — one browser, one context, deviceScaleFactor 1, viewport-sized
 *                captures. Never `fullPage` on a tall page: a 2880x7460 raster
 *                is ~86 MB before compression, and several of those are what
 *                took the machine down.
 *   4. close   — browser first, then the server, then verify the port is free.
 *
 * Browser review also only runs in a session the maintainer has agreed to
 * (docs/WORKPLAN.md, "Rules for every batch"). This script does not ask for
 * that consent — the operator has it before running the command.
 *
 * Usage:
 *   pnpm check:visual                      # 390 / 768 / 1440, default out dir
 *   pnpm check:visual --widths 390,1440
 *   pnpm check:visual --out ./review-shots
 *   pnpm check:visual --path /archive
 *   pnpm check:visual --anchor archive    # a section below the fold
 */
import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { homedir, freemem } from "node:os";
import { join } from "node:path";

const MIN_FREE_GB = 3;
const PORT = 3000;
const ORIGIN = `http://localhost:${PORT}`;
const DEFAULT_WIDTHS = [390, 768, 1440];

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return fallback;
  return process.argv[index + 1] ?? fallback;
}

/** Playwright's own browser cache — we never download a browser from here. */
function findChromium() {
  const root = join(homedir(), "AppData", "Local", "ms-playwright");
  if (!existsSync(root)) return null;
  const dir = readdirSync(root)
    .filter((name) => name.startsWith("chromium-"))
    .sort()
    .pop();
  if (dir === undefined) return null;
  const exe = join(root, dir, "chrome-win64", "chrome.exe");
  return existsSync(exe) ? exe : null;
}

async function waitForServer(timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(ORIGIN, { signal: AbortSignal.timeout(3000) });
      if (response.ok) return true;
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

async function isPortFree() {
  try {
    await fetch(ORIGIN, { signal: AbortSignal.timeout(2000) });
    return false;
  } catch {
    return true;
  }
}

const findings = [];
const note = (step, detail) => {
  findings.push({ step, ...detail });
  console.log(`[${step}] ${JSON.stringify(detail)}`);
};

// ---------------------------------------------------------------- 1. debug --
const freeGB = freemem() / 1024 ** 3;
if (freeGB < MIN_FREE_GB) {
  console.error(`ABORT: only ${freeGB.toFixed(2)} GB free, need ${MIN_FREE_GB} GB.`);
  console.error("Close other work first — this machine has 8 GB total.");
  process.exit(1);
}
note("debug", { freeRamGB: Number(freeGB.toFixed(2)) });

if (!existsSync(join(process.cwd(), ".next"))) {
  console.error("ABORT: no .next build found. Run `pnpm build` first, on its own.");
  console.error("This script never builds — a build and a browser must not run together.");
  process.exit(1);
}

if (!(await isPortFree())) {
  console.error(`ABORT: something is already serving ${ORIGIN}. Stop it first.`);
  process.exit(1);
}

const executablePath = findChromium();
if (executablePath === null) {
  console.error("ABORT: no cached Chromium found under ~/AppData/Local/ms-playwright.");
  process.exit(1);
}

const outDir = arg("out", join(process.cwd(), ".visual-check"));
mkdirSync(outDir, { recursive: true });
const widths = arg("widths", DEFAULT_WIDTHS.join(",")).split(",").map(Number);
const routePath = arg("path", "/");
// Every capture is prefixed with the route's slug: reviewing two routes in one
// session (B3 reviews `/` and `/archive`) otherwise has the second run silently
// overwrite the first run's reduced-motion and no-JS screenshots.
const baseSlug = routePath === "/" ? "home" : routePath.replace(/\W+/g, "-").replace(/^-|-$/g, "");
// `--anchor attention` reviews a section that sits below the fold. It is a URL
// fragment, not a scripted scroll: the browser does the scrolling natively, so
// the same capture works in the no-JavaScript pass, where `page.evaluate` cannot
// run at all. Captures stay viewport-sized — never `fullPage` on a tall page.
const anchor = arg("anchor", null);
const target = ORIGIN + routePath + (anchor === null ? "" : `#${anchor}`);
const slug = anchor === null ? baseSlug : `${baseSlug}-${anchor}`;

// --------------------------------------------------------------- 2. server --
console.log("\nstarting server (alone)…");
// Run Next's bin through this Node process rather than the `.bin` shim: on
// Windows the shim is a `.cmd` wrapper and spawning it through a shell both
// fails to resolve and leaves an orphan process behind at teardown.
const require = createRequire(import.meta.url);
const nextBin = require.resolve("next/dist/bin/next");
const server = spawn(process.execPath, [nextBin, "start"], {
  cwd: process.cwd(),
  stdio: "ignore",
});

let browser = null;
let exitCode = 0;

try {
  if (!(await waitForServer(60_000))) throw new Error("server did not come up within 60s");
  note("server", { origin: ORIGIN, status: "up" });

  // ------------------------------------------------------------ 3. screens --
  browser = await chromium.launch({ executablePath });
  const context = await browser.newContext({
    viewport: { width: widths[0], height: 900 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  for (const width of widths) {
    await page.setViewportSize({ width, height: width < 768 ? 844 : 900 });
    await page.goto(target, { waitUntil: "load" });
    // Let mount animations finish, then force a fresh composited frame —
    // a headless capture can otherwise show an element mid-reveal.
    await page.waitForTimeout(2500);
    await page.evaluate(
      () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
    );

    await page.screenshot({ path: join(outDir, `${slug}-${width}-top.png`) });

    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    note("screens", {
      width,
      overflows: overflow.scrollWidth > overflow.clientWidth,
      ...overflow,
    });

    // Anything still transparent after the reveals have settled would mean
    // content that depends on motion to be readable — docs/DESIGN.md §8.
    const stillTransparent = await page.evaluate(
      () =>
        [...document.querySelectorAll(".hero-lines > span, .hero-supporting, .reveal-on-mount")]
          .filter((el) => parseFloat(getComputedStyle(el).opacity) < 1).length,
    );
    note("screens", { width, elementsBelowFullOpacity: stillTransparent });
  }
  await context.close();

  // reduced motion + no JavaScript, at the widest target only
  for (const variant of ["reduced-motion", "no-js"]) {
    const ctx = await browser.newContext({
      viewport: { width: widths[widths.length - 1], height: 900 },
      deviceScaleFactor: 1,
      reducedMotion: variant === "reduced-motion" ? "reduce" : "no-preference",
      javaScriptEnabled: variant !== "no-js",
    });
    const p = await ctx.newPage();
    await p.goto(target, { waitUntil: "load" });
    await p.waitForTimeout(1500);
    await p.screenshot({ path: join(outDir, `${slug}-${variant}.png`) });
    // Report *which* element, not just how many: a bare count cannot be acted on,
    // and chasing one down otherwise means an improvised second browser run.
    const hidden = await p.evaluate(() =>
      [...document.querySelectorAll(".hero-lines > span, .hero-supporting, .reveal-on-mount")]
        .filter((el) => parseFloat(getComputedStyle(el).opacity) < 1)
        .map((el) => ({
          tag: el.tagName.toLowerCase(),
          id: el.id || null,
          className: el.className,
          opacity: getComputedStyle(el).opacity,
          animationName: getComputedStyle(el).animationName,
        })),
    );
    note("screens", { variant, elementsBelowFullOpacity: hidden.length, below: hidden });
    await ctx.close();
  }
} catch (error) {
  console.error(`\nFAILED: ${error instanceof Error ? error.message : String(error)}`);
  exitCode = 1;
} finally {
  // ----------------------------------------------------------- 4. teardown --
  if (browser !== null) await browser.close();
  note("close", { browser: "closed" });

  server.kill();
  await new Promise((resolve) => setTimeout(resolve, 1500));
  // `next start` spawns a child; on Windows killing the wrapper can leave it.
  if (!(await isPortFree())) {
    spawn("taskkill", ["/PID", String(server.pid), "/T", "/F"], { stdio: "ignore", shell: true });
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  const free = await isPortFree();
  note("close", { portFree: free, freeRamGB: Number((freemem() / 1024 ** 3).toFixed(2)) });
  if (!free) {
    console.error(`WARNING: ${ORIGIN} is still serving — stop it by hand before running anything else.`);
    exitCode = 1;
  }
}

console.log(`\nscreenshots in ${outDir}`);
console.log(exitCode === 0 ? "visual check complete." : "visual check finished with problems.");
process.exit(exitCode);
