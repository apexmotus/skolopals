// Part 4 (admin) and the story: Lindiwe reviews Amahle's application and accepts it, which raises the first invoice.
import { scene, login, go, shot, settle, ADMIN, DESKTOP } from "./lib.mjs";

await scene("admin review", DESKTOP, async (page) => {
  await login(page, ADMIN, "lindiwe.khumalo");
  await shot(page, "a01-dashboard", [
    { target: page.getByRole("navigation").first() },
    { target: page.getByText("Applications to review").locator("xpath=ancestor::*[self::a or self::div][2]") },
    { target: page.getByText("Outstanding fees").locator("xpath=ancestor::*[self::a or self::div][2]") },
  ]);

  await go(page, `${ADMIN}/admin/enrolments`);
  const row = page.getByText("Amahle Mthembu").first();
  await shot(page, "a02-applications-queue", [{ target: page.getByRole("link", { name: /to review/i }).first() }, { target: row }]);
  await page.getByRole("link", { name: /Amahle Mthembu/ }).first().click().catch(() => row.click());
  await settle(page);
  console.log("  application", page.url());

  await shot(page, "a03-application-detail", [{ target: page.getByText("Report card", { exact: true }) }, { target: page.getByText("Aptitude test", { exact: true }) }], { full: true });
  await shot(page, "a04-application-decision", [
    { target: page.getByText("Classes with seats") },
    { target: page.getByRole("button", { name: "Accept", exact: true }) },
    { target: page.getByRole("button", { name: /request more information/i }) },
    { target: page.getByRole("button", { name: /decline/i }) },
  ]);
  await page.getByRole("button", { name: "Accept", exact: true }).click();
  await page.getByRole("button", { name: /accept and send the invoice/i }).waitFor();
  await shot(page, "a05-accept-dialog", [{ target: page.getByRole("button", { name: /accept and send the invoice/i }) }]);
  await page.getByRole("button", { name: /accept and send the invoice/i }).click();
  await page.getByText("Still to pay").waitFor({ timeout: 30_000 });
  await settle(page);
  await shot(page, "a06-accepted", [{ target: page.getByText("Still to pay") }, { target: page.getByText("Offer lapses after") }]);
});
