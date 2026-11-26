// Retakes: pages that were still loading, and the Users list with real people's rows hidden (POPIA).
import { scene, login, go, shot, settle, WEB, ADMIN, DESKTOP } from "./lib.mjs";

await scene("retake tutor overview", DESKTOP, async (page) => {
  await login(page, WEB, "johan.vandermerwe");
  await page.getByText(/good (morning|afternoon|evening)/i).first().waitFor({ timeout: 30_000 });
  await settle(page);
  await shot(page, "t01-overview", [{ target: page.getByRole("navigation").first() }]);
});

await scene("retake admin", DESKTOP, async (page) => {
  await login(page, ADMIN, "lindiwe.khumalo");

  await go(page, `${ADMIN}/admin/users`);
  // Only the made-up UAT accounts may appear in the manual.
  await page.evaluate(() => {
    for (const row of document.querySelectorAll("tbody tr")) {
      if (!/@uat\.skolopals\.test/.test(row.textContent ?? "")) row.remove();
    }
  });
  await shot(page, "a18-users", [{ target: page.getByText("Add a user", { exact: true }) }, { target: page.locator("#role, select").first() }, { target: page.getByRole("button", { name: /deactivate/i }).first() }]);

  await go(page, `${ADMIN}/admin/payments`);
  await page.getByRole("link", { name: /history|verified|all/i }).first().click().catch(() => {});
  await settle(page);
  await shot(page, "a07b-payments-empty");

  await go(page, `${ADMIN}/admin/learners`);
  await page.evaluate(() => {
    // Hide the tester's own sample family so only the story and seed learners show.
    for (const h of document.querySelectorAll("h2, h3, p, span")) {
      if (h.textContent?.trim() === "Ayanda Moloko") h.closest("section, article, div[class*='rounded']")?.remove();
    }
  });
  await shot(page, "a19-learners", [{ target: page.getByText("Amahle Mthembu").first() }, { target: page.getByRole("link", { name: "Manage" }).first() }]);
});
