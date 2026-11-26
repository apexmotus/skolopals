// The story continues: Thuli pays the first invoice with PayShap and uploads proof; Lindiwe verifies it.
import { fileURLToPath } from "node:url";
import { scene, login, go, shot, settle, WEB, ADMIN, PHONE, DESKTOP } from "./lib.mjs";

const PROOF = fileURLToPath(new URL("../../../../docs/manual/fixtures/sample-payshap-proof.png", import.meta.url));
const only = process.argv[2]; // "pay" | "verify"

if (!only || only === "pay") {
  await scene("guardian pays", PHONE, async (page) => {
    await login(page, WEB, "thuli.mthembu");
    const dialog = page.getByRole("dialog");
    const upload = page.getByText("Upload proof of payment", { exact: true }).first();
    await upload.or(page.getByText("Pay with PayShap", { exact: true }).first()).first().waitFor({ timeout: 30_000 });
    if (!(await upload.isVisible())) {
      const pay = page.getByText("Pay with PayShap", { exact: true }).first();
      await shot(page, "g20-overview-pay", [{ target: page.getByText(/has been accepted/i).first() }, { target: pay }]);
      await pay.click();
      await dialog.waitFor();
      await page.waitForTimeout(500);
      await shot(page, "g21-pay-review", [{ target: dialog.getByText("Total to pay") }, { target: page.getByRole("button", { name: /continue to payment/i }) }]);
      await page.getByRole("button", { name: /continue to payment/i }).click();
      await page.waitForTimeout(500);
      await shot(page, "g22-pay-payshap", [
        { target: dialog.getByText("ShapID", { exact: true }) },
        { target: dialog.getByText("Amount", { exact: true }) },
        { target: dialog.getByText("Reference", { exact: true }) },
        { target: page.getByRole("button", { name: /i have made the payment/i }) },
      ]);
      await page.getByRole("button", { name: /i have made the payment/i }).click();
      await page.waitForTimeout(3000);
      await settle(page);
    }
    if (!(await page.locator('input[type="file"]').count())) {
      await shot(page, "g22b-overview-upload-proof", [{ target: page.getByText(/you told us you have paid/i) }, { target: upload }]);
      await upload.click();
      await dialog.waitFor();
    }
    await page.locator('input[type="file"]').waitFor({ state: "attached", timeout: 30_000 });
    await page.locator('input[type="file"]').setInputFiles(PROOF);
    await dialog.getByText("sample-payshap-proof.png").waitFor({ timeout: 30_000 });
    await shot(page, "g23-pay-upload", [
      { target: dialog.getByText("sample-payshap-proof.png") },
      { target: page.locator("#paid_amount") },
      { target: page.getByRole("button", { name: /submit proof/i }) },
    ]);
    await page.getByRole("button", { name: /submit proof/i }).click();
    await page.getByRole("button", { name: "Done" }).waitFor({ timeout: 30_000 });
    await shot(page, "g24-pay-being-checked", [{ target: dialog.getByText("Amount you paid") }]);
    await page.getByRole("button", { name: "Done" }).click();
    await settle(page);
    await go(page, `${WEB}/parent/account`);
    await shot(page, "g25-fees-statement", [], { full: true });
  });
}

if (!only || only === "verify") {
  await scene("admin verifies", DESKTOP, async (page) => {
    await login(page, ADMIN, "lindiwe.khumalo");
    await go(page, `${ADMIN}/admin/payments`);
    const row = page.getByText(/Thuli Mthembu|Amahle Mthembu/).first();
    await shot(page, "a07-payments-queue", [{ target: row }]);
    await page.getByRole("link").filter({ hasText: /Thuli Mthembu|Amahle Mthembu|Check|Review|Open/ }).first().click();
    await settle(page);
    console.log("  submission", page.url());
    await shot(page, "a08-payment-proof", [
      { target: page.getByText("Verify", { exact: true }) },
      { target: page.getByRole("button", { name: /verify payment/i }) },
      { target: page.getByText("Reject", { exact: true }) },
    ], { full: true });
    await page.getByRole("button", { name: /verify payment/i }).click();
    await page.getByRole("button", { name: /yes, verify/i }).waitFor();
    await shot(page, "a09-verify-dialog", [{ target: page.getByRole("button", { name: /yes, verify/i }) }]);
    await page.getByRole("button", { name: /yes, verify/i }).click();
    await page.waitForTimeout(4000);
    await settle(page);
    await shot(page, "a10-verified", []);
    await go(page, `${ADMIN}/admin/enrolments?tab=placement`);
    await shot(page, "a11-needs-placement", [{ target: page.getByText("Amahle Mthembu").first() }]);
  });
}
