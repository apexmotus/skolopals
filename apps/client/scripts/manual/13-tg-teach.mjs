// Tutor guide, part 4: Palesa's first sign-in, her online class, and confirming the register.
// Parts (run in this order, at the right times):
//   portal   any time        Palesa signs in and sees the tutor portal
//   class    before START    Lindiwe creates the online class for today and places Amahle Mthembu
//   join     START-15..+10   Thuli joins for Amahle through the Join link (Present, not Late)
//   register after END      Palesa opens the register: "Joined 10:52", then Confirm register
// Notifies: Thuli (Amahle placed in a class). Uses only seeded families.
import { scene, login, go, shot, settle, WEB, ADMIN, DESKTOP, PHONE, APPLICANT } from "./lib.mjs";

const NAME = "Maths Extra Gr 4-7 (Online)";
const START = process.env.START ?? "11:00";
const END = process.env.END ?? "11:30";
const t = (s) => ({ target: s });
const only = process.argv[2];

if (only === "portal") {
  await scene("tg portal", DESKTOP, async (page) => {
    await login(page, WEB, APPLICANT, process.env.APPLICANT_PASSWORD);
    await go(page, `${WEB}/tutor`);
    await shot(page, "tt01-overview", [
      { target: page.getByRole("link", { name: "Overview" }).first() },
      { target: page.getByRole("link", { name: "My schedule" }).first() },
      { target: page.getByRole("link", { name: "Attendance register" }).first() },
    ]);
    await go(page, `${WEB}/tutor/schedule`);
    await shot(page, "tt02-schedule");
  });
}

if (only === "class") {
  await scene("tg class", DESKTOP, async (page) => {
    await login(page, ADMIN, "lindiwe.khumalo");
    await go(page, `${ADMIN}/admin/timetable`);
    if (!(await page.getByText(NAME).count())) {
      const form = page.locator("form").filter({ has: page.locator("#class_name") });
      await page.fill("#class_name", NAME);
      await page.selectOption("#subject_code", { label: "Mathematics" });
      await page.selectOption("#language_code", { label: "English" });
      for (const g of ["Grade 4", "Grade 5", "Grade 6", "Grade 7"]) await form.getByLabel(g, { exact: true }).check();
      await page.selectOption("#tutor_id", { label: "Palesa Mokoena" });
      const term = await page.locator("#term_id option", { hasText: "Term 4 2026" }).first().getAttribute("value");
      await page.selectOption("#term_id", term);
      await page.selectOption("#delivery_mode", "online");
      await page.fill("#class_capacity", "8");
      await page.fill("#meeting_url", "https://meet.google.com/abc-defg-hij");
      await form.getByLabel("Fri", { exact: true }).check();
      await page.fill("#starts_at_time", START);
      await page.fill("#ends_at_time", END);
      await shot(page, "ta16-add-online-class", [
        { target: page.locator("#class_name") },
        { target: page.locator("#tutor_id") },
        { target: page.locator("#delivery_mode") },
        { target: page.locator("#meeting_url") },
        { target: page.getByRole("button", { name: /create class/i }) },
      ]);
      await page.getByRole("button", { name: /create class/i }).click();
      await form.getByText(/created with \d+ sessions/i).waitFor({ timeout: 60_000 });
      console.log(`  ${(await form.getByText(/created with/i).innerText()).trim()}`);
    }
    await go(page, `${ADMIN}/admin/timetable`);
    const card = page.locator("div").filter({ has: page.getByText(NAME, { exact: true }) }).filter({ has: page.getByRole("button", { name: "Add learner" }) }).last();
    if (!(await card.locator(":not(option)").getByText("Amahle Mthembu · Grade 6", { exact: true }).filter({ visible: true }).count())) {
      await card.getByRole("combobox", { name: /learner to add/i }).selectOption({ label: "Amahle Mthembu · Grade 6" });
      await shot(page, "ta17-place-learner", [{ target: card.getByText(NAME, { exact: true }) }, { target: card.getByRole("combobox", { name: /learner to add/i }) }, { target: card.getByRole("button", { name: "Add learner" }) }]);
      await card.getByRole("button", { name: "Add learner" }).click();
      await page.waitForTimeout(3000);
      await settle(page);
      await shot(page, "ta18-placed", [{ target: card.locator(":not(option)").getByText("Amahle Mthembu · Grade 6", { exact: true }).filter({ visible: true }) }]);
    }
  });
}

if (only === "join") {
  await scene("tg join", PHONE, async (page) => {
    await login(page, WEB, "thuli.mthembu");
    await go(page, `${WEB}/parent/timetable`);
    const row = page.locator("li, tr, div").filter({ hasText: NAME }).filter({ has: page.getByRole("link", { name: /join/i }) }).first();
    const join = row.getByRole("link", { name: /join/i }).first();
    await shot(page, "tg01-family-join", [{ target: row.getByText(NAME).first() }, { target: join }]);
    const href = await join.getAttribute("href");
    await go(page, WEB + href);
    const go2 = page.getByRole("button", { name: /^Join as/ });
    await shot(page, "tg02-join-page", [t("Ready to join?"), { target: go2 }]);
    // Joining records the click, then redirects to the meeting.
    if (await go2.count()) {
      await go2.click();
      await page.waitForURL((u) => !u.href.startsWith(WEB), { timeout: 30_000 }).catch(() => {});
    }
    console.log(`  ended at ${page.url()}`);
  });
}

if (only === "register") {
  await scene("tg register", DESKTOP, async (page) => {
    await login(page, WEB, APPLICANT, process.env.APPLICANT_PASSWORD);
    await go(page, `${WEB}/tutor/register`);
    const confirm = page.getByRole("button", { name: "Confirm register" });
    await shot(page, "tt03-register-online", [
      { target: page.locator('select[name="session"]') },
      { target: page.getByText(/Joined \d/).first() },
      { target: page.locator('select[name^="status_"]').first() },
      { target: confirm },
    ]);
    await confirm.click();
    await page.waitForTimeout(4000);
    await settle(page);
    await page.getByText("Register saved. Parents see it now.").waitFor({ timeout: 30_000 });
    await shot(page, "tt04-register-confirmed", [{ target: page.getByText("Register saved. Parents see it now.") }]);
  });
}

if (only === "attendance") {
  // Read-only: what Thuli sees once the register is confirmed.
  await scene("tg attendance", PHONE, async (page) => {
    await login(page, WEB, "thuli.mthembu");
    await go(page, `${WEB}/parent/attendance`);
    await shot(page, "tg03-attendance", [{ target: page.getByText(NAME).first() }, { target: page.getByText("Present", { exact: true }).first() }]);
  });
}
