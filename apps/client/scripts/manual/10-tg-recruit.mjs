// Tutor guide, part 1: Lindiwe opens tutor applications, the website shows "Apply to teach",
// and Palesa Mokoena (a Gmail plus-address, so the confirmation email reaches Mollo) signs up.
// Resumable: skips opening if a round is already open, and sign-up if the account exists.
import { scene, login, go, shot, settle, WEB, ADMIN, DESKTOP, PHONE } from "./lib.mjs";

import { APPLICANT } from "./lib.mjs";
const t = (s) => ({ target: s });
const only = process.argv[2];

if (!only || only === "open") {
  await scene("tg open applications", DESKTOP, async (page) => {
    await login(page, ADMIN, "lindiwe.khumalo");
    await go(page, `${ADMIN}/admin/tutor-applications`);
    if (process.env.REOPEN && (await page.getByRole("button", { name: "Close now" }).count())) {
      await page.getByRole("button", { name: "Close now" }).click();
      await page.getByRole("button", { name: "Open applications" }).waitFor({ timeout: 30_000 });
    }
    const openBtn = page.getByRole("button", { name: "Open applications" });
    if (await openBtn.count()) {
      if (!process.env.REOPEN) await shot(page, "ta01-closed", [t("Applications are closed."), { target: openBtn }]);
      await openBtn.click();
      const dialog = page.getByRole("dialog");
      await dialog.locator("#closes_on").fill("2026-12-18");
      await dialog.locator("#message").fill(
        "We’re growing! Teach small groups of learners in Damonsville, after school and on Saturday mornings, at the centre or online.",
      );
      for (const s of ["Mathematics", "Physical Sciences"]) {
        await dialog.locator("label").filter({ hasText: new RegExp(`^${s}$`) }).locator('input[name="needs"]').check();
      }
      await shot(page, "ta02-open-dialog", [
        { target: dialog.locator("#closes_on") },
        { target: dialog.locator("#message") },
        { target: dialog.locator("label").filter({ hasText: /^Mathematics$/ }) },
        { target: dialog.getByText("Require a police clearance certificate") },
        { target: dialog.getByRole("button", { name: "Open applications" }) },
      ]);
      await dialog.getByRole("button", { name: "Open applications" }).click();
      await dialog.getByText(/Applications are open/).waitFor({ timeout: 30_000 });
      await dialog.getByRole("button", { name: "Done" }).click();
      await settle(page);
    }
    await shot(page, "ta03-open", [
      { target: page.getByText(/applications so far/) },
      { target: page.getByText(/Subjects needed/) },
      { target: page.getByRole("button", { name: "Edit" }) },
      { target: page.getByRole("button", { name: "Close now" }) },
    ]);
  });
}

if (!only || only === "public") {
  await scene("tg public", PHONE, async (page) => {
    // The public status is cached for up to a minute.
    for (let i = 0; i < 8; i++) {
      await go(page, `${WEB}/`);
      if (await page.getByRole("link", { name: "Apply to teach" }).count()) break;
      await page.waitForTimeout(15_000);
    }
    await shot(page, "tp01-home", [{ target: page.getByRole("link", { name: "Apply to teach" }).first() }]);
    const banner = page.getByText(/looking for tutors/i).first();
    if (await banner.count()) await shot(page, "tp02-home-banner", [{ target: banner }, { target: page.getByRole("link", { name: "Apply to teach" }).last() }]);
    await go(page, `${WEB}/teach`);
    await shot(page, "tp03-teach-signed-out", [
      t("Most needed:"),
      t("You’ll need:"),
      { target: page.getByRole("link", { name: "Create an account" }) },
      { target: page.getByRole("link", { name: "I already have one" }) },
    ]);
  });
}

if (!only || only === "signup") {
  await scene("tg signup", PHONE, async (page) => {
    await go(page, `${WEB}/signup?next=/teach`);
    await page.fill("#first_name", "Palesa");
    await page.fill("#last_name", "Mokoena");
    await page.fill("#email", APPLICANT);
    await page.fill("#phone", "072 555 0142");
    await page.fill("#password", process.env.APPLICANT_PASSWORD);
    await page.fill("#confirm", process.env.APPLICANT_PASSWORD);
    await shot(page, "tp04-signup", [{ target: page.locator("#email") }, { target: page.locator("#password") }, { target: page.getByRole("button", { name: /create|sign up/i }) }]);
    await page.getByRole("button", { name: /create|sign up/i }).click();
    const sent = page.getByText("Check your email");
    await sent.or(page.getByText(/already|registered/i)).first().waitFor({ timeout: 30_000 });
    if (await sent.count()) await shot(page, "tp05-check-email", [{ target: sent }]);
    else console.log("  account already exists: skipped");
  });
}
