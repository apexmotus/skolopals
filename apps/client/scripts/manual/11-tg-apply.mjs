// Tutor guide, part 2: Palesa fills in the 7-step application on her phone and sends it.
// Needs APPLICANT_PASSWORD (scratchpad file, never in the repo). Set STOP=1 to walk the form and
// stop before "Send application", for retakes.
import { fileURLToPath } from "node:url";
import { scene, login, go, shot, settle, WEB, PHONE } from "./lib.mjs";
import { APPLICANT } from "./lib.mjs";

const FIX = (f) => fileURLToPath(new URL(`../../../../docs/manual/fixtures/${f}`, import.meta.url));
const t = (s) => ({ target: s });
const next = (page) => page.getByRole("button", { name: "Next", exact: true });

async function upload(page, label, file) {
  await page.getByLabel(label, { exact: true }).setInputFiles(FIX(file));
  await page.getByText(`✓ ${file}`).waitFor({ timeout: 60_000 });
}

await scene("tg apply", PHONE, async (page) => {
  await login(page, WEB, APPLICANT, process.env.APPLICANT_PASSWORD);
  await go(page, `${WEB}/teach`);
  if (await page.getByText("Your tutor application").count()) {
    console.log("  already applied: status card only");
  } else {
    // 1. About you
    await page.locator("#first_name").fill("Palesa");
    await page.locator("#last_name").fill("Mokoena");
    if (!(await page.locator("#phone").inputValue())) await page.locator("#phone").fill("072 555 0142");
    await shot(page, "tp06-about", [
      { target: page.getByText("Step 1 of 7") },
      { target: page.locator("#email") },
      { target: page.locator("#phone") },
      t("My WhatsApp number is the same"),
      { target: next(page) },
    ]);
    await next(page).click();

    // 2. Address
    await page.locator("#line1").fill("14 Mampe Street");
    await page.locator("#line2").fill("Damonsville");
    await page.locator("#city").fill("Brits");
    await page.locator("#province").selectOption("North West");
    await shot(page, "tp07-address", [{ target: page.locator("#line1") }, { target: page.locator("#province") }, { target: page.locator("#country") }]);
    await next(page).click();

    // 3. Subjects
    const subject = page.locator('select[id^="subject-"]').first();
    const maths = await subject.locator("option", { hasText: /^Mathematics/ }).first().getAttribute("value");
    await subject.selectOption(maths);
    for (const g of ["Grade 4", "Grade 5", "Grade 6", "Grade 7"]) await page.getByLabel(g, { exact: true }).check();
    await page.getByLabel("English", { exact: true }).check();
    await shot(page, "tp08-subjects", [
      { target: subject },
      { target: page.getByText("Grades", { exact: true }) },
      { target: page.getByText("Languages you can teach it in", { exact: true }) },
      { target: page.getByRole("button", { name: "Add another subject" }) },
    ]);
    await next(page).click();

    // 4. CV & qualifications
    await upload(page, "CV / resume", "sample-cv.pdf");
    await upload(page, "Qualification 1", "sample-qualification.pdf");
    await page.locator('input[id^="q-title-"]').first().fill("BEd (Intermediate Phase)");
    await page.locator('input[id^="q-inst-"]').first().fill("North-West University");
    await page.locator('input[id^="q-year-"]').first().fill("2021");
    await shot(page, "tp09-documents", [
      t("✓ sample-cv.pdf"),
      t("✓ sample-qualification.pdf"),
      { target: page.locator('input[id^="q-title-"]').first() },
      { target: page.getByRole("button", { name: /add another qualification/i }) },
    ]);
    await next(page).click();

    // 5. Identity
    await upload(page, "Photo of your ID", "sample-id.jpg");
    await upload(page, "Selfie", "sample-selfie.jpg");
    await shot(page, "tp10-identity", [t("✓ sample-id.jpg"), t("Back of your smart ID card (optional)"), t("✓ sample-selfie.jpg")]);
    await next(page).click();

    // 6. References (made up; example.com addresses)
    const refs = [
      ["Thandeka Mahlangu", "Head of Department, previous school", "072 555 0101", "thandeka@example.com"],
      ["Johannes Botha", "Principal, previous school", "072 555 0102", ""],
      ["Refiloe Sithole", "Parent of a learner I tutored", "072 555 0103", ""],
    ];
    for (const [i, [name, rel, phone, mail]] of refs.entries()) {
      await page.locator(`#ref-name-${i}`).fill(name);
      await page.locator(`#ref-rel-${i}`).fill(rel);
      await page.locator(`#ref-phone-${i}`).fill(phone);
      if (mail) await page.locator(`#ref-email-${i}`).fill(mail);
    }
    await shot(page, "tp11-references", [{ target: page.locator("#ref-name-0") }, { target: page.locator("#ref-rel-0") }, { target: page.locator("#ref-phone-0") }]);
    await next(page).click();

    // 7. Review
    await settle(page);
    await shot(page, "tp12a-review", [{ target: page.getByRole("button", { name: "Edit" }).first() }]);
    for (const box of [/may process my information/, /references have agreed/, /information I’ve given is true/]) {
      await page.getByLabel(box).check();
    }
    await shot(page, "tp12b-consent", [
      { target: page.getByText(/may process my information/) },
      { target: page.getByText(/references have agreed/) },
      { target: page.getByText(/information I’ve given is true/) },
      { target: page.getByRole("button", { name: "Send application" }) },
    ]);
    if (process.env.STOP) return;
    await page.getByRole("button", { name: "Send application" }).click();
    await page.getByText("Your tutor application").waitFor({ timeout: 90_000 });
    await settle(page);
  }
  await shot(page, "tp13-received", [t("Your tutor application"), t("Received"), { target: page.getByRole("button", { name: "Withdraw" }) }]);
});
