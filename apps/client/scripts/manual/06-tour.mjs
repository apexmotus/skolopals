// Read-only tour of the remaining screens for every role. Nothing here changes data.
import { scene, login, go, shot, settle, WEB, ADMIN, PHONE, DESKTOP } from "./lib.mjs";

const t = (s) => ({ target: s });
const only = process.argv[2];

const tours = {
  thuli: ["web", "thuli.mthembu", PHONE, async (page) => {
    await shot(page, "g26-overview-enrolled", [t("Payment confirmed: Amahle is enrolled"), t("Next sessions")]);
    await go(page, `${WEB}/parent/timetable`);
    const join = page.getByRole("link", { name: /join on/i });
    await shot(page, "g27-timetable-join", [{ target: join.nth(1) }, t("Room A (Foundation & Intermediate)")]);
    const href = await join.nth(1).getAttribute("href");
    await go(page, WEB + href);
    await shot(page, "g28-join-not-open", [t("Join")]);
    await go(page, `${WEB}/parent/learners`);
    await shot(page, "g29-my-learners", [t("Enrol another child"), t("Edit details")]);
    await page.getByRole("link", { name: "Edit details" }).first().click();
    await settle(page);
    await page.getByText("Authorised to collect", { exact: true }).scrollIntoViewIfNeeded();
    await shot(page, "g30-learner-collectors", [{ target: page.getByText("Authorised to collect", { exact: true }) }, { target: page.getByText("Nokuthula Khoza") }, { target: page.getByRole("button", { name: "Add person" }) }]);
    await shot(page, "g31-learner-leave-alone", [t("Leaving the centre on their own"), t("Allow Amahle to leave on their own")]);
    await go(page, `${WEB}/parent/account`);
    await shot(page, "g32-fees-statement");
  }],
  lerato: ["web", "lerato.mabaso", PHONE, async (page) => {
    await go(page, `${WEB}/parent/attendance`);
    await shot(page, "g33-attendance-door", [t("In 21:52 · Out 21:53"), { target: page.getByText("Late", { exact: true }).first() }]);
    await go(page, `${WEB}/parent/notifications`);
    await shot(page, "g34-notification-signed-out", [t("Karabo has been signed out")]);
  }],
  grace: ["web", "grace.molefe", PHONE, async (page) => {
    await shot(page, "g35-overview-family", [{ target: page.getByRole("button", { name: /menu/i }).or(page.getByRole("button", { name: /open/i })).first() }]);
    await page.getByRole("button", { name: /menu/i }).first().click().catch(() => {});
    await page.waitForTimeout(600);
    await shot(page, "g36-menu", [t("Fees & statement"), t("Messages")]);
    await page.keyboard.press("Escape");
    await go(page, `${WEB}/parent/progress`);
    await shot(page, "g37-progress");
    await go(page, `${WEB}/parent/account`);
    await shot(page, "g38-statement-family");
    const inv = page.getByRole("link", { name: /SKP-|invoice|view/i }).first();
    if (await inv.count()) {
      await inv.click();
      await settle(page);
      await shot(page, "g39-invoice", []);
    }
    await go(page, `${WEB}/parent/messages`);
    await shot(page, "g40-messages", [{ target: page.locator("select").first() }]);
    await go(page, `${WEB}/parent/resources`);
    await shot(page, "g41-resources");
  }],
  neo: ["web", "neo.molefe", PHONE, async (page) => {
    await shot(page, "l01-overview");
    await go(page, `${WEB}/learner/timetable`);
    await shot(page, "l02-timetable");
    await go(page, `${WEB}/learner/progress`);
    await shot(page, "l03-reports");
    await go(page, `${WEB}/learner/resources`);
    await shot(page, "l04-resources");
    await go(page, `${WEB}/learner/messages`);
    await shot(page, "l05-messages");
  }],
  johan: ["web", "johan.vandermerwe", DESKTOP, async (page) => {
    for (const [p, n] of [["learners", "t05-learners"], ["assessments", "t06-assessments"], ["reports", "t07-reports"], ["sessions", "t08-sessions-taught"], ["messages", "t09-messages"], ["reviews", "t16-reviews"]]) {
      await go(page, `${WEB}/tutor/${p}`);
      await shot(page, n);
    }
  }],
  lindiwe: ["admin", "lindiwe.khumalo", DESKTOP, async (page) => {
    for (const [p, n] of [
      ["users", "a18-users"], ["learners", "a19-learners"], ["sessions", "a20-sessions"], ["door", "a21-door"],
      ["billing", "a22-billing"], ["expenses", "a23-expenses"], ["enquiries", "a24-enquiries"],
      ["notifications", "a25-announcements"], ["reports", "a26-kpis"], ["enrolments?tab=payment", "a27-awaiting-payment"],
    ]) {
      await go(page, `${ADMIN}/admin/${p}`);
      await shot(page, n);
    }
    await go(page, `${ADMIN}/admin/learners`);
    await page.getByRole("link", { name: /Amahle Mthembu/ }).first().click().catch(() => {});
    await settle(page);
    await shot(page, "a28-learner-detail", [], { full: true });
  }],
};

for (const [name, [app, who, device, fn]] of Object.entries(tours)) {
  if (only && !only.split(",").includes(name)) continue;
  await scene(`tour ${name}`, device, async (page) => {
    await login(page, app === "admin" ? ADMIN : WEB, who);
    await fn(page);
  });
}
