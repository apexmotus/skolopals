#!/usr/bin/env node
// Read-only post-deploy smoke test. Usage: node scripts/smoke.mjs <base-url>
// Checked in CI after every dev deploy, and manually against uat/production.
import { chromium } from "playwright";

const baseUrl = process.argv[2];
if (!baseUrl) {
  console.error("Usage: node scripts/smoke.mjs <base-url>");
  process.exit(1);
}

const targetHost = new URL(baseUrl).host;

const CHECKS = [
  { path: "/", mustContain: "Skolopals" },
  { path: "/pricing", mustContain: "Our fees" },
  { path: "/timetable", mustContain: "When we are open" },
  { path: "/privacy", mustContain: "Privacy notice" },
  { path: "/tutors", mustContain: "Our tutors" },
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

    const finalHost = new URL(page.url()).host;
    if (finalHost !== targetHost) {
      console.error(`FAIL ${check.path}: redirected off-host to ${finalHost} (Deployment Protection / SSO wall?)`);
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
        console.log(`PASS ${check.path}`);
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
  console.error("\nSmoke test failed.");
  process.exit(1);
}
console.log("\nAll smoke checks passed.");
