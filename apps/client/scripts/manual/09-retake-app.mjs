import { scene, login, go, shot, settle, ADMIN, DESKTOP } from "./lib.mjs";
await scene("retake application", DESKTOP, async (page) => {
  await login(page, ADMIN, "lindiwe.khumalo");
  await go(page, `${ADMIN}/admin/enrolments?tab=all`);
  for (const tab of ["", "?tab=placement", "?tab=payment", "?tab=all"]) {
    await go(page, `${ADMIN}/admin/enrolments${tab}`);
    const link = page.getByRole("link", { name: /Amahle Mthembu/ }).first();
    if (await link.count()) { await link.click(); await settle(page); break; }
  }
  await page.waitForTimeout(3000);
  await shot(page, "a03-application-detail", [{ target: page.getByText("Report card", { exact: true }) }, { target: page.getByText("Aptitude test", { exact: true }) }]);
  await page.getByText("Aptitude test", { exact: true }).scrollIntoViewIfNeeded();
  await shot(page, "a03b-aptitude", [{ target: page.getByText("Aptitude test", { exact: true }) }, { target: page.getByText(/band \d of 5/i).first() }, { target: page.getByText("Classes with seats") }]);
});
