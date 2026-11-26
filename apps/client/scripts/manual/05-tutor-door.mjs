// Part 3 (tutor): the door and the register. Johan signs Karabo in and out of the 17:00 one-on-one
// (agreed with the client: this notifies Karabo's guardian, Lerato Mabaso), then opens the online register.
import { scene, login, go, shot, settle, WEB, DESKTOP, PHONE } from "./lib.mjs";

const pick = async (page, label) => {
  const select = page.locator('select[name="session"]');
  const value = await select.locator("option", { hasText: label }).first().getAttribute("value");
  await go(page, `${WEB}/tutor/register?session=${value}`);
};

const only = process.argv[2];

if (!only || only === "door") {
  // The door is phone-first: a tutor uses it standing at the entrance.
  await scene("tutor door", PHONE, async (page) => {
    await login(page, WEB, "johan.vandermerwe");
    await go(page, `${WEB}/tutor/register`);
    await pick(page, "Karabo M. (Gr 9) — Wed 25 Nov");
    const door = page.locator("div").filter({ has: page.getByText("At the door", { exact: true }) }).filter({ has: page.getByText("Karabo Mabaso") }).last();
    const signIn = door.getByRole("button", { name: "Sign in", exact: true });
    if (await signIn.count()) {
      await shot(page, "t10-door-not-arrived", [{ target: door.getByText("Not arrived") }, { target: signIn }]);
      await signIn.click();
      await door.getByText("In the centre").waitFor({ timeout: 30_000 });
      await settle(page);
    }
    const signOut = door.getByRole("button", { name: "Sign out", exact: true });
    if (await signOut.count()) {
      await shot(page, "t11-door-in-centre", [{ target: door.getByText(/^In \d/) }, { target: signOut }]);
      await signOut.click();
      await shot(page, "t12-door-collector", [
        { target: door.getByText(/who is collecting/i) },
        { target: door.locator('input[value^="guardian:"]').first().locator("xpath=ancestor::label") },
        { target: door.getByRole("button", { name: /someone else is here/i }) },
      ]);
      await door.getByRole("button", { name: /someone else is here/i }).click();
      await shot(page, "t13-door-refuse", [{ target: door.getByText(/don’t release/i) }, { target: door.getByRole("link", { name: /^call/i }).first() }]);
      await door.getByRole("button", { name: /someone else is here/i }).click();
      await door.locator('input[value^="guardian:"]').first().check();
      await door.getByRole("button", { name: "Sign out", exact: true }).last().click();
      await door.getByText("Gone home").waitFor({ timeout: 30_000 });
      await settle(page);
    }
    await shot(page, "t14-door-gone-home", [{ target: door.getByText(/collected by/i) }, { target: door.getByRole("button", { name: /undo sign-out/i }) }]);
    await page.getByText("Present", { exact: true }).or(page.getByText("Late", { exact: true })).first().scrollIntoViewIfNeeded();
    await shot(page, "t15-register-after-door", [], { full: true });
  });
}

if (!only || only === "register") {
  await scene("tutor register", DESKTOP, async (page) => {
    await login(page, WEB, "johan.vandermerwe");
    await shot(page, "t01-overview", [{ target: page.getByRole("navigation").first() }]);
    await go(page, `${WEB}/tutor/schedule`);
    await shot(page, "t02-schedule");
    await go(page, `${WEB}/tutor/register`);
    await pick(page, "Senior Maths Gr 8-9 (English) — Wed 25 Nov");
    await shot(page, "t03-register-in-centre", [
      { target: page.locator('select[name="session"]') },
      { target: page.getByText("At the door", { exact: true }) },
    ], { full: true });
    await pick(page, "Afrikaans Gr 4-7 (Online) — Wed 25 Nov");
    await shot(page, "t04-register-online", [
      { target: page.getByText(/join on/i).first() },
      { target: page.getByText(/didn’t open the link|joined \d/i).first() },
      { target: page.getByRole("combobox").nth(1) },
      { target: page.getByRole("button", { name: /confirm register/i }) },
    ]);
  });
}
