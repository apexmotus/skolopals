// Usage: node recon.mjs <web|admin> <account> <phone|desktop> <path>...  — prints page text and saves plain shots.
import { scene, login, go, shot, WEB, ADMIN, PHONE, DESKTOP } from "./lib.mjs";
const [app, who, dev, ...paths] = process.argv.slice(2);
const base = app === "admin" ? ADMIN : WEB;
await scene(`recon ${who}`, dev === "phone" ? PHONE : DESKTOP, async (page) => {
  await login(page, base, who);
  for (const p of paths) {
    await go(page, base + p);
    const text = (await page.locator("main").first().innerText().catch(() => page.innerText("body"))).replace(/\n{2,}/g, "\n");
    console.log(`\n=== ${p} → ${page.url()}\n${text.slice(0, +(process.env.RECON_CHARS ?? 2500))}`);
    await shot(page, `_recon${p.replace(/\W+/g, "-")}`);
  }
});
