// Part 1 (guardian), the start of the story: public site, sign-in, enrolment and the aptitude test.
// Thuli Mthembu (signed up, no children) enrols Amahle, Grade 6. Creates a real application in UAT.
import { fileURLToPath } from "node:url";
import { scene, login, go, shot, settle, WEB, PHONE } from "./lib.mjs";

const REPORT = fileURLToPath(new URL("../../../../docs/manual/fixtures/sample-report-card.pdf", import.meta.url));
const only = process.argv[2]; // "public" | "enrol" | "test"

if (!only || only === "public") {
  await scene("public site", PHONE, async (page) => {
    await go(page, WEB);
    await shot(page, "g01-home", [{ target: page.getByRole("button", { name: /menu/i }) }, { target: page.getByRole("link", { name: /enrol/i }) }]);
    await go(page, `${WEB}/pricing`);
    await shot(page, "g02-fees");
    await go(page, `${WEB}/signup`);
    await shot(page, "g03-signup", [{ target: page.locator("form").first() }]);
    await go(page, `${WEB}/login`);
    await shot(page, "g04-login", [
      { target: page.locator("#email") },
      { target: page.locator("#password") },
      { target: page.getByRole("link", { name: /forgot/i }) },
    ]);
    await go(page, `${WEB}/forgot-password`);
    await shot(page, "g05-forgot-password", [{ target: page.locator("form").first() }]);
  });
}

if (!only || only === "enrol") {
  await scene("enrol Amahle", PHONE, async (page) => {
    await login(page, WEB, "thuli.mthembu");
    await shot(page, "g06-overview-empty", [{ target: page.getByRole("link", { name: /start enrolment/i }) }], { full: true });

    await go(page, `${WEB}/enrol`);
    const next = () => page.getByRole("button", { name: "Next", exact: true }).click();
    const radios = page.locator('input[name="package_code"]');
    await radios.nth(1).check();
    await shot(page, "g07-enrol-package", [
      { target: page.getByRole("navigation", { name: /application steps/i }).or(page.locator("ol").first()) },
      { target: radios.nth(1).locator("xpath=ancestor::label") },
      { target: page.getByRole("button", { name: "Next", exact: true }) },
    ]);
    await next();

    await page.fill("#first_name", "Amahle");
    await page.fill("#last_name", "Mthembu");
    await page.fill("#date_of_birth", "2015-03-14");
    await page.selectOption("#grade_code", { label: "Grade 6" });
    await page.fill("#school_name", "Laerskool Ridgeview");
    await page.selectOption("#home_language_code", { label: "isiZulu" });
    await page.selectOption("#relationship", "mother");
    await shot(page, "g08-enrol-child", [{ target: page.locator("#first_name") }, { target: page.locator("#grade_code") }], { full: true });
    await next();

    await page.locator('input[type="file"]').setInputFiles(REPORT);
    await page.getByText("sample-report-card.pdf").first().waitFor({ timeout: 30_000 });
    await page.selectOption("#report_term", { index: 3 });
    await shot(page, "g09-enrol-report", [{ target: page.getByText("sample-report-card.pdf") }, { target: page.locator("#report_term") }], { full: true });
    await next();

    await page.locator('input[name="subject"][value="mathematics"]').check();
    await page.locator('input[name="subject"]').nth(1).check().catch(() => {});
    await shot(page, "g10-enrol-subjects", [{ target: page.locator('input[name="subject"]:checked').first().locator("xpath=ancestor::div[1]") }, { target: page.locator('select[name^="medium_"]').first() }], { full: true });
    await next();

    await shot(page, "g11-enrol-tutor", [{ target: page.locator('select[name="preferred_tutor"]') }]);
    await next();

    await page.getByLabel("I am the emergency contact").check();
    if (await page.locator("#self_phone").isVisible()) await page.fill("#self_phone", "0825550142");
    await page.fill("#ec_first_name", "Sizwe");
    await page.fill("#ec_last_name", "Mthembu");
    await page.fill("#ec_relationship", "Uncle");
    await page.fill("#ec_phone", "0835550177");
    await page.getByLabel("I am authorised to collect my child").check();
    await page.fill("#col_first_name", "Nokuthula");
    await page.fill("#col_last_name", "Khoza");
    await page.fill("#col_relationship", "Aunt");
    await page.fill("#col_phone", "0845550190");
    await page.fill("#col_id_number_last4", "4821");
    await shot(page, "g12-enrol-safety", [
      { target: page.getByText("I am the emergency contact") },
      { target: page.locator("#ec_first_name") },
      { target: page.getByText("I am authorised to collect my child") },
      { target: page.locator("#col_id_number_last4") },
    ], { full: true });
    for (const box of await page.locator('input[type="checkbox"][required]').all()) await box.check();
    await shot(page, "g13-enrol-consent", [
      { target: page.getByText("Your permission") },
      { target: page.getByText("Optional").first() },
      { target: page.getByText("Check and send") },
      { target: page.getByRole("button", { name: /send application/i }) },
    ], { full: true });
    await page.getByRole("button", { name: /send application/i }).click();
    await page.waitForURL(/assessment/, { timeout: 45_000 });
    await settle(page);
    console.log("  application at", page.url());
    await shot(page, "g14-test-intro", [{ target: page.getByText("It’s not a pass or fail test") }, { target: page.getByRole("button", { name: /^start$/i }) }], { full: true });
  });
}

if (!only || only === "test") {
  await scene("aptitude test", PHONE, async (page) => {
    await login(page, WEB, "thuli.mthembu");
    await go(page, `${WEB}/parent`);
    const link = page.getByRole("link", { name: /test|carry on|continue/i }).first();
    await shot(page, "g15-overview-tracker", [{ target: link }], { full: true });
    await link.click();
    await settle(page);
    await page.getByRole("button", { name: /^(start|carry on)$/i }).click();
    let n = 0;
    while (n < 40) {
      const finish = page.getByText(/you’re finished/i);
      if (await finish.isVisible().catch(() => false)) break;
      const options = page.locator('fieldset label');
      await options.first().waitFor({ timeout: 20_000 });
      // A mix of answers, so the result is realistic rather than perfect.
      await options.nth(n % 3 === 2 ? 1 : 0).click();
      if (n === 1) await shot(page, "g16-test-question", [{ target: options.first() }, { target: page.getByRole("button", { name: /next|finish/i }) }], { full: true });
      await page.getByRole("button", { name: /^(next|finish)$/i }).click();
      await page.waitForTimeout(700);
      n += 1;
    }
    await settle(page);
    await shot(page, "g17-test-done", [{ target: page.getByRole("button", { name: /grown-up/i }) }]);
    await page.getByRole("button", { name: /grown-up/i }).click();
    await shot(page, "g18-application-sent", [{ target: page.getByText("Application sent for review") }]);
    await go(page, `${WEB}/parent`);
    await shot(page, "g19-overview-in-review", [], { full: true });
  });
}
