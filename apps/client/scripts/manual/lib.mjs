// Helpers for capturing the user manual's screenshots from UAT.
// Each scene script logs in as a seeded UAT account (docs/UAT-TEST-DATA.md),
// walks a flow and saves annotated screenshots to docs/manual/images/.
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

export const WEB = "https://skolopals-web-uat.vercel.app";
export const ADMIN = "https://skolopals-admin-uat.vercel.app";
export const OUT = fileURLToPath(new URL("../../../../docs/manual/images/", import.meta.url));

// The shared UAT seed password lives in docs/UAT-TEST-DATA.md; pass it in, don't hard-code it.
const PASSWORD = process.env.UAT_PASSWORD;

export const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
export const DESKTOP = { viewport: { width: 1366, height: 860 }, deviceScaleFactor: 2 };

export const email = (who) => `${who}@uat.skolopals.test`;
// Tutor guide applicant: a Gmail plus-address, so its confirmation email reaches Mollo.
export const APPLICANT = "mollodagod+tutor@gmail.com";

export async function open(device = DESKTOP) {
  if (!PASSWORD) throw new Error("Set UAT_PASSWORD");
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  const context = await browser.newContext({ ...device, colorScheme: "dark", locale: "en-ZA", timezoneId: "Africa/Johannesburg" });
  const page = await context.newPage();
  page.on("pageerror", (e) => console.error("  page error:", e.message));
  return { browser, context, page };
}

export async function login(page, base, who, password = PASSWORD) {
  await page.goto(`${base}/login`, { waitUntil: "load", timeout: 45_000 });
  await settle(page);
  await page.fill("#email", who.includes("@") ? who : email(who));
  await page.fill("#password", password);
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30_000 }), page.click('button[type="submit"]')]);
  await settle(page);
}

export async function go(page, url) {
  await page.goto(url, { waitUntil: "load", timeout: 45_000 });
  await settle(page);
}

export async function settle(page) {
  await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => {});
  // The client shows a branded spinner while a route loads.
  await page.waitForTimeout(600);
}

/**
 * Save a screenshot with numbered callouts. Each callout is
 * { target: Locator | string (text), n?: number, box?: true }; a string is matched as visible text.
 * `full` captures the whole page instead of the viewport. `clip` is a locator to crop to.
 */
export async function shot(page, name, callouts = [], { full = false, clip } = {}) {
  // A focused field's ring looks like a callout.
  await page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur());
  const boxes = [];
  let i = 0;
  for (const c of callouts) {
    i += 1;
    const loc = typeof c.target === "string" ? page.getByText(c.target, { exact: false }).first() : c.target.first();
    await loc.scrollIntoViewIfNeeded().catch(() => {});
    const b = await loc.boundingBox();
    if (!b) {
      console.warn(`  ! ${name}: callout ${c.n ?? i} not found (${typeof c.target === "string" ? c.target : "locator"})`);
      continue;
    }
    // Page coordinates, so later scrolling doesn't move the callout off its target.
    const [sx, sy] = await page.evaluate(() => [window.scrollX, window.scrollY]);
    boxes.push({ ...b, x: b.x + sx, y: b.y + sy, n: c.n ?? i });
  }
  const modal = await page.locator("dialog[open]").count();
  if (!full && !clip && boxes.length && !modal) {
    // Scroll so the callouts are in view, the first near the top.
    const top = Math.min(...boxes.map((b) => b.y));
    await page.evaluate((y) => window.scrollTo(0, Math.max(0, y - 120)), top);
    await page.waitForTimeout(300);
  }
  await page.evaluate(
    ({ boxes }) => {
      document.querySelectorAll("[data-manual-callout]").forEach((n) => n.remove());
      const dialog = document.querySelector("dialog[open]");
      for (const b of boxes) {
        const ring = document.createElement("div");
        ring.setAttribute("data-manual-callout", "");
        Object.assign(ring.style, {
          position: "absolute",
          left: `${b.x - 5}px`,
          top: `${b.y - 5}px`,
          width: `${b.width + 10}px`,
          height: `${b.height + 10}px`,
          border: "3px solid #f5c211",
          borderRadius: "10px",
          boxShadow: "0 0 0 3px rgba(0,0,0,.35)",
          zIndex: 2147483646,
          pointerEvents: "none",
        });
        const badge = document.createElement("div");
        badge.setAttribute("data-manual-callout", "");
        badge.textContent = String(b.n);
        const left = b.x - 16;
        Object.assign(badge.style, {
          position: "absolute",
          left: `${Math.max(2, left)}px`,
          top: `${Math.max(2, b.y - 16)}px`,
          width: "26px",
          height: "26px",
          lineHeight: "26px",
          borderRadius: "50%",
          background: "#f5c211",
          color: "#1a0a28",
          font: "800 15px/26px system-ui, sans-serif",
          textAlign: "center",
          boxShadow: "0 2px 6px rgba(0,0,0,.5)",
          zIndex: 2147483647,
          pointerEvents: "none",
        });
        // A modal <dialog> sits in the top layer, above any z-index: draw inside it, fixed to the viewport.
        if (dialog) {
          for (const n of [ring, badge]) {
            n.style.position = "fixed";
            n.style.left = `${parseFloat(n.style.left) - window.scrollX}px`;
            n.style.top = `${parseFloat(n.style.top) - window.scrollY}px`;
          }
          dialog.append(ring, badge);
        } else {
          document.body.append(ring, badge);
        }
      }
    },
    { boxes },
  );
  const file = path.join(OUT, `${name}.png`);
  if (clip) {
    await (typeof clip === "string" ? page.locator(clip) : clip).first().screenshot({ path: file });
  } else {
    await page.screenshot({ path: file, fullPage: full });
  }
  await page.evaluate(() => document.querySelectorAll("[data-manual-callout]").forEach((n) => n.remove()));
  console.log(`  saved ${name}.png${boxes.length ? ` (${boxes.length} callouts)` : ""}`);
}

/** Run a scene, always closing the browser. */
export async function scene(title, device, fn) {
  console.log(`# ${title}`);
  const { browser, page, context } = await open(device);
  try {
    await fn(page, context);
  } catch (e) {
    await page.screenshot({ path: path.join(OUT, `_error-${title.replace(/\W+/g, "-")}.png`) }).catch(() => {});
    console.error(`  FAILED: ${e.message}`);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}
