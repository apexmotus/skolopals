// Tutor guide, part 3: Lindiwe reviews Palesa's application, asks for a police clearance certificate,
// Palesa uploads it, and Lindiwe approves her, sets her pay and activates her.
// Run one part at a time: review | clearance | approve. Each part skips what is already done.
// Notifies: Palesa (shortlisted, clearance request, approved) and the admins (clearance received).
import { fileURLToPath } from "node:url";
import { scene, login, go, shot, settle, WEB, ADMIN, DESKTOP, PHONE, APPLICANT } from "./lib.mjs";

const FIX = (f) => fileURLToPath(new URL(`../../../../docs/manual/fixtures/${f}`, import.meta.url));
const t = (s) => ({ target: s });
const only = process.argv[2];
const card = (page, title) => page.locator("section, div").filter({ has: page.getByText(title, { exact: true }) }).last();

async function openApplication(page) {
  await go(page, `${ADMIN}/admin/tutor-applications`);
  await page.getByRole("link", { name: "Palesa Mokoena" }).first().click();
  await page.getByText("Contact and address").waitFor({ timeout: 30_000 });
  await settle(page);
}

if (!only || only === "review") {
  await scene("tg review", DESKTOP, async (page) => {
    await login(page, ADMIN, "lindiwe.khumalo");
    await go(page, `${ADMIN}/admin/tutor-applications`);
    await shot(page, "ta04-list", [
      { target: page.getByRole("link", { name: "Tutor applications" }).first() },
      { target: page.getByRole("link", { name: "Palesa Mokoena" }).first() },
      { target: page.getByText("Needed", { exact: true }).first() },
    ]);
    await openApplication(page);
    if (await page.getByRole("button", { name: "Shortlist" }).count()) await shot(page, "ta05-detail", [t("Decision"), { target: page.getByRole("button", { name: "Shortlist" }) }, { target: page.getByRole("button", { name: "Reject" }) }, { target: page.getByRole("button", { name: "Approve" }) }]);

    const checked = page.getByRole("button", { name: "Mark identity checked" });
    if (await checked.count()) {
      await page.getByAltText(/ID \(front\)|Selfie/).first().waitFor({ timeout: 20_000 }).catch(() => {});
      await shot(page, "ta06-identity", [{ target: page.getByText("Identity", { exact: true }) }, { target: page.getByText("ID (front)", { exact: true }) }, { target: page.getByText("Selfie", { exact: true }).first() }, { target: checked }]);
      await checked.click();
      await page.getByText(/^Checked /).waitFor({ timeout: 30_000 });
      await settle(page);
    }

    await page.getByText("What they can teach").scrollIntoViewIfNeeded();
    await shot(page, "ta07-teach-docs-refs", [t("What they can teach"), t("CV and qualifications"), t("References")]);

    const shortlist = page.getByRole("button", { name: "Shortlist" });
    if (await shortlist.count()) {
      await shortlist.click();
      await page.getByText("Shortlisted", { exact: true }).first().waitFor({ timeout: 30_000 });
      await openApplication(page);
    }

    const request = page.getByRole("button", { name: "Request police clearance" });
    if (await request.count()) {
      await request.click();
      const dialog = page.getByRole("dialog");
      await dialog.locator("textarea").fill("Please upload your SAPS police clearance certificate before your interview on 3 December.");
      await shot(page, "ta08-request-clearance", [{ target: dialog.locator("textarea") }, { target: dialog.getByRole("button", { name: "Send request" }) }]);
      await dialog.getByRole("button", { name: "Send request" }).click();
      await dialog.getByText(/Requested\./).waitFor({ timeout: 30_000 });
      await dialog.getByRole("button", { name: "Done" }).click();
      await openApplication(page);
    }
    await page.getByText("Police clearance", { exact: true }).scrollIntoViewIfNeeded();
    await shot(page, "ta09-clearance-requested", [{ target: page.getByText("Police clearance", { exact: true }) }, { target: page.getByText(/Your message/) }]);
  });
}

if (!only || only === "clearance") {
  await scene("tg clearance", PHONE, async (page) => {
    await login(page, WEB, APPLICANT, process.env.APPLICANT_PASSWORD);
    await go(page, `${WEB}/teach`);
    const send = page.getByRole("button", { name: "Send certificate" });
    if (await send.count()) {
      await shot(page, "tp14-clearance-requested", [t("Shortlisted"), t("We need your police clearance certificate"), { target: page.getByLabel("Police clearance certificate", { exact: true }).locator("xpath=..") }]);
      await page.getByLabel("Police clearance certificate", { exact: true }).setInputFiles(FIX("sample-police-clearance.pdf"));
      await page.getByText("✓ sample-police-clearance.pdf").waitFor({ timeout: 60_000 });
      await shot(page, "tp15-clearance-ready", [t("✓ sample-police-clearance.pdf"), { target: send }]);
      await send.click();
      await page.getByText("We need your police clearance certificate").waitFor({ state: "detached", timeout: 60_000 }).catch(() => {});
      await settle(page);
    }
    await go(page, `${WEB}/teach`);
    await shot(page, "tp16-shortlisted", [t("Shortlisted")]);
  });
}

if (!only || only === "approve") {
  await scene("tg approve", DESKTOP, async (page) => {
    await login(page, ADMIN, "lindiwe.khumalo");
    await go(page, `${ADMIN}/admin/tutors`);
    let tutorLink = page.getByRole("link", { name: "Palesa Mokoena" });
    if (!(await tutorLink.count())) {
      await openApplication(page);
      await page.getByText("Police clearance", { exact: true }).scrollIntoViewIfNeeded();
      await shot(page, "ta10-clearance-received", [{ target: page.getByText("Police clearance", { exact: true }) }, { target: page.getByText("Police clearance", { exact: true }).last() }]);
      await page.getByRole("button", { name: "Approve" }).click();
      const dialog = page.getByRole("dialog");
      await shot(page, "ta11-approve-dialog", [{ target: dialog.getByText("suspended") }, { target: dialog.getByRole("button", { name: "Approve" }) }]);
      await dialog.getByRole("button", { name: "Approve" }).click();
      await page.waitForURL(/\/admin\/tutors\/[0-9a-f-]+/, { timeout: 60_000 });
    } else {
      await tutorLink.first().click();
    }
    await settle(page);
    if (await page.getByText(/^Approved\./).count()) {
      await shot(page, "ta12-tutor-approved", [t("Approved."), { target: page.getByText("suspended").first() }, t("What they teach")]);
    }
    const tutorUrl = page.url().split("?")[0];

    // Pay first, then activate.
    if (await page.getByText("No rate recorded.").count()) {
      const pay = page.locator("form").filter({ has: page.locator('input[name="amount_rand"]') });
      await pay.locator('select[name="pay_basis"]').selectOption("per_hour");
      await pay.locator('input[name="amount_rand"]').fill("180");
      await shot(page, "ta13-pay", [{ target: pay.locator('select[name="pay_basis"]') }, { target: pay.locator('input[name="amount_rand"]') }, { target: pay.getByRole("button", { name: "Set rate" }) }]);
      await pay.getByRole("button", { name: "Set rate" }).click();
      await page.getByText("No rate recorded.").waitFor({ state: "detached", timeout: 30_000 });
      await go(page, tutorUrl);
    }
    const status = page.locator('select[name="status"]');
    if ((await status.inputValue()) !== "active") {
      await status.selectOption("active");
      await shot(page, "ta14-activate", [{ target: status }, { target: page.locator("form").filter({ has: status }).getByRole("button", { name: "Update" }) }]);
      await page.locator("form").filter({ has: status }).getByRole("button", { name: "Update" }).click();
      await page.waitForTimeout(3000);
      await go(page, tutorUrl);
    }
    await shot(page, "ta15-tutor-active", [{ target: page.getByText("active", { exact: true }).first() }, t("Pay")]);
    console.log(`  tutor page: ${tutorUrl}`);
  });
}
