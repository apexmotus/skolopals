// Admin creates an online class (Afrikaans Gr 4-7, Wed + Thu 15:00-16:00) and places Amahle in it.
import { scene, login, go, shot, settle, ADMIN, DESKTOP } from "./lib.mjs";

const NAME = "Afrikaans Gr 4-7 (Online)";
const TUTORS = ["Johan van der Merwe"];

await scene("online class", DESKTOP, async (page) => {
  await login(page, ADMIN, "lindiwe.khumalo");
  // Johan needs Afrikaans (in Afrikaans) at Gr 4-7 before he can be given the class.
  await go(page, `${ADMIN}/admin/tutors`);
  await shot(page, "a16-tutors", [{ target: page.getByText("Add a tutor", { exact: true }) }, { target: page.getByText("Johan van der Merwe").first() }]);
  await page.getByRole("link", { name: "Johan van der Merwe" }).first().click();
  await settle(page);
  for (const grade of ["Grade 4", "Grade 5", "Grade 6", "Grade 7"]) {
    if (await page.getByText(`Afrikaans · ${grade}`).count()) continue;
    const cf = page.locator("form").filter({ has: page.locator('select[name="grade_code"]') });
    await cf.locator('select[name="subject_code"]').selectOption({ label: "Afrikaans" });
    await cf.locator('select[name="grade_code"]').selectOption({ label: grade });
    await cf.locator('input[name="language_code"][value="english"]').uncheck();
    await cf.locator('input[name="language_code"][value="afrikaans"]').check();
    if (grade === "Grade 4") {
      await shot(page, "a17-tutor-competency", [
        { target: page.getByText("What they teach") },
        { target: page.locator('select[name="subject_code"]') },
        { target: page.locator('select[name="grade_code"]') },
        { target: cf.locator('input[name="language_code"][value="afrikaans"]').locator("xpath=ancestor::label") },
        { target: cf.getByRole("button") },
      ]);
    }
    await cf.getByRole("button").click();
    await page.getByText(`Afrikaans · ${grade}`).waitFor({ timeout: 20_000 });
  }
  await go(page, `${ADMIN}/admin/timetable`);

  if (!(await page.getByText(NAME).count())) {
    const form = page.locator("form").filter({ has: page.locator("#class_name") });
    let created = false;
    for (const tutor of TUTORS) {
      await page.fill("#class_name", NAME);
      await page.selectOption("#subject_code", { label: "Afrikaans" });
      await page.selectOption("#language_code", { label: "Afrikaans" });
      for (const g of ["Grade 4", "Grade 5", "Grade 6", "Grade 7"]) await form.getByLabel(g, { exact: true }).check();
      await page.selectOption("#tutor_id", { label: tutor });
      await page.selectOption("#term_id", { label: /Term 4 2026/ }).catch(async () => {
        const opt = await page.locator("#term_id option", { hasText: "Term 4 2026" }).getAttribute("value");
        await page.selectOption("#term_id", opt);
      });
      await page.selectOption("#delivery_mode", "online");
      await page.fill("#class_capacity", "8");
      await page.fill("#meeting_url", "https://meet.google.com/abc-defg-hij");
      for (const d of ["Wed", "Thu"]) await form.getByLabel(d, { exact: true }).check();
      await page.fill("#starts_at_time", "15:00");
      await page.fill("#ends_at_time", "16:00");
      if (tutor === TUTORS[0]) {
        await shot(page, "a12-add-online-class", [
          { target: page.locator("#class_name") },
          { target: page.locator("#tutor_id") },
          { target: page.locator("#delivery_mode") },
          { target: page.locator("#meeting_url") },
          { target: page.getByRole("button", { name: /create class/i }) },
        ]);
      }
      await page.getByRole("button", { name: /create class/i }).click();
      await page.waitForTimeout(4000);
      const msg = await form.innerText();
      if (/created with \d+ sessions/i.test(msg)) {
        console.log(`  created with ${tutor}`);
        await shot(page, "a13-class-created", [{ target: form.getByText(/created with/i) }]);
        created = true;
        break;
      }
      console.log(`  ${tutor}: ${msg.split("\n").find((l) => /not recorded|teach|open|error|required/i.test(l)) ?? "not created"}`);
      await go(page, `${ADMIN}/admin/timetable`);
    }
    if (!created) throw new Error("No tutor could take the class");
  }

  await go(page, `${ADMIN}/admin/timetable`);
  const card = page.locator("div").filter({ has: page.getByText(NAME, { exact: true }) }).filter({ has: page.getByRole("button", { name: "Add learner" }) }).last();
  await card.getByRole("combobox", { name: /learner to add/i }).selectOption({ label: "Amahle Mthembu · Grade 6" });
  await shot(page, "a14-place-learner", [{ target: card.getByText(NAME, { exact: true }) }, { target: card.getByRole("combobox", { name: /learner to add/i }) }, { target: card.getByRole("button", { name: "Add learner" }) }]);
  await card.getByRole("button", { name: "Add learner" }).click();
  await page.waitForTimeout(3000);
  await settle(page);
  await shot(page, "a15-placed", [{ target: page.getByText("Amahle Mthembu · Grade 6").first() }]);
});
