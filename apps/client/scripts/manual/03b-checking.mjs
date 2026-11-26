import { scene, login, go, shot, WEB, PHONE } from "./lib.mjs";
await scene("payment being checked", PHONE, async (page) => {
  await login(page, WEB, "thuli.mthembu");
  const view = page.getByText("View payment", { exact: true }).first();
  await view.waitFor({ timeout: 30_000 });
  await shot(page, "g24-overview-checking", [{ target: page.getByText(/checking your payment/i) }, { target: view }]);
  await view.click();
  await page.getByRole("dialog").waitFor();
  await page.waitForTimeout(600);
  await shot(page, "g24b-pay-being-checked", [{ target: page.getByRole("dialog").getByText("Amount you paid") }]);
  await go(page, `${WEB}/parent/account`);
  await shot(page, "g25-fees-statement", []);
});
