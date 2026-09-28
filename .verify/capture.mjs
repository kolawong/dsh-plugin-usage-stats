/** Capture the usage-stats panel at several scroll positions for UI review. */
import { chromium } from "playwright";
import { readFileSync } from "node:fs";

const OUT = new URL("./ui-review/", import.meta.url).pathname;
const auth = JSON.parse(readFileSync("/root/.dsh/plugins/dsh-plugin-auth-webserver/state.json", "utf8"));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto("http://127.0.0.1:3080/", { waitUntil: "networkidle" });
await page.waitForTimeout(1500);

// Log in through the local gateway if the login page is showing.
if (await page.locator('text=登 录').isVisible().catch(() => false)) {
  await page.locator('input').nth(0).fill(auth.username);
  await page.locator('input').nth(1).fill(auth.password);
  await page.locator('text=登 录').click();
  await page.waitForTimeout(3000);
}

// Open the plugin's sidebar panel row.
const row = page.locator('text=使用统计').first();
await row.click();
await page.waitForTimeout(2500);
await page.locator('text=使用统计与成本看板').first().waitFor({ timeout: 15000 });

for (let i = 0; i < 8; i += 1) {
  await page.screenshot({ path: `${OUT}scroll-${i}.png` });
  const scrolled = await page.evaluate(() => {
    const nodes = [...document.querySelectorAll("div")];
    const sc = nodes.filter((n) => n.scrollHeight > n.clientHeight + 200 && n.clientHeight > 400).pop();
    if (!sc) return false;
    sc.scrollTop += sc.clientHeight * 0.92;
    return sc.scrollTop + sc.clientHeight < sc.scrollHeight - 5;
  });
  await page.waitForTimeout(400);
  if (!scrolled) break;
}
await browser.close();
console.log("done");
