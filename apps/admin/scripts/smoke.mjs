#!/usr/bin/env node
// Read-only post-deploy smoke test for the Admin portal. Usage: node scripts/smoke.mjs <base-url>
import { chromium } from "playwright";

const baseUrl = process.argv[2];
if (!baseUrl) {
  console.error("Usage: node scripts/smoke.mjs <base-url>");
  process.exit(1);
}

const targetHost = new URL(baseUrl).host;

const CHECKS = [
  { path: "/", mustContain: "Admin Sign In", expectPath: "/login" },
  { path: "/login", mustContain: "Admin Sign In", expectPath: "/login" },
];

let failed = false;

const browser = await chromium.launch();
try {
  for (const check of CHECKS) {
    const page = await browser.newPage();
    const consoleErrors = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    const url = new URL(check.path, baseUrl).toString();
    const response = await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 });

    const finalUrl = new URL(page.url());
    if (finalUrl.host !== targetHost) {
      console.error(`FAIL ${check.path}: redirected off-host to ${finalUrl.host} (Deployment Protection / SSO wall?)`);
      failed = true;
    } else if (check.expectPath && finalUrl.pathname !== check.expectPath) {
      console.error(`FAIL ${check.path}: expected redirect to ${check.expectPath}, landed on ${finalUrl.pathname}`);
      failed = true;
    } else if (!response || !response.ok()) {
      console.error(`FAIL ${check.path}: HTTP ${response?.status()}`);
      failed = true;
    } else {
      const body = await page.textContent("body");
      if (!body?.includes(check.mustContain)) {
        console.error(`FAIL ${check.path}: expected copy "${check.mustContain}" not found on the page`);
        failed = true;
      } else {
        console.log(`PASS ${check.path} -> ${finalUrl.pathname}`);
      }
    }

    if (consoleErrors.length > 0) {
      console.error(`FAIL ${check.path}: ${consoleErrors.length} browser console error(s):`);
      for (const err of consoleErrors) console.error(`  - ${err}`);
      failed = true;
    }

    await page.close();
  }
} finally {
  await browser.close();
}

if (failed) {
  console.error("\nAdmin smoke test failed.");
  process.exit(1);
}
console.log("\nAll admin smoke checks passed.");
