// Re-captures the enrolment steps on a phone, viewport by viewport. Stops before "Send application",
// so nothing is submitted (the report card upload leaves one unused staging file).
import { fileURLToPath } from "node:url";
import { scene, login, go, shot, WEB, PHONE } from "./lib.mjs";

const REPORT = fileURLToPath(new URL("../../../../docs/manual/fixtures/sample-report-card.pdf", import.meta.url));

await scene("enrol retake", PHONE, async (page) => {
  await login(page, WEB, "thuli.mthembu");
  await go(page, `${WEB}/enrol`);
  const next = () => page.getByRole("button", { name: "Next", exact: true }).click();
  await page.locator('input[name="package_code"]').nth(1).check();
  await next();
  await page.fill("#first_name", "Amahle");
  await page.fill("#last_name", "Mthembu");
  await page.fill("#date_of_birth", "2015-03-14");
  await page.selectOption("#grade_code", { label: "Grade 6" });
  await page.fill("#school_name", "Laerskool Ridgeview");
  await page.selectOption("#home_language_code", { label: "isiZulu" });
  await shot(page, "g08-enrol-child", [{ target: page.locator("#first_name") }, { target: page.locator("#date_of_birth") }, { target: page.locator("#grade_code") }]);
  await next();
  await page.locator('input[type="file"]').setInputFiles(REPORT);
  await page.getByText("sample-report-card.pdf").first().waitFor({ timeout: 30_000 });
  await page.selectOption("#report_term", { index: 3 });
  await shot(page, "g09-enrol-report", [{ target: page.getByText("sample-report-card.pdf").first() }, { target: page.locator("#report_year") }, { target: page.locator("#report_term") }]);
  await next();
  await page.locator('input[name="subject"][value="mathematics"]').check();
  await page.locator('input[name="subject"][value="afrikaans"]').check();
  await shot(page, "g10-enrol-subjects", [
    { target: page.locator('input[name="subject"][value="afrikaans"]').locator("xpath=ancestor::label") },
    { target: page.locator('select[name="medium_afrikaans"]') },
  ]);
  await next();
  await next();
  await page.getByLabel("I am the emergency contact").check();
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
  await shot(page, "g12a-enrol-emergency", [{ target: page.getByText("I am the emergency contact") }, { target: page.locator("#ec_first_name") }]);
  await shot(page, "g12b-enrol-collect", [{ target: page.getByText("I am authorised to collect my child") }, { target: page.locator("#col_first_name") }, { target: page.locator("#col_id_number_last4") }]);
  for (const box of await page.locator('input[type="checkbox"][required]').all()) await box.check();
  await shot(page, "g13a-enrol-consent", [
    { target: page.getByText("Processing the learner").first() },
    { target: page.getByText("Storing information outside South Africa").first() },
    { target: page.getByText("Photographs and schoolwork in marketing").first() },
  ]);
  await shot(page, "g13b-enrol-check", [{ target: page.getByText("Check and send") }, { target: page.getByText(/your first payment would be/i) }, { target: page.getByRole("button", { name: /send application/i }) }]);
  // Deliberately not sent.
});
