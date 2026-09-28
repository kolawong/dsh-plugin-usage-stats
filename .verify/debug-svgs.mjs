import { chromium } from "playwright";
import { readFileSync } from "node:fs";
const auth = JSON.parse(readFileSync("/root/.dsh/plugins/dsh-plugin-auth-webserver/state.json", "utf8"));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto("http://127.0.0.1:3080/", { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
if (await page.locator("text=登 录").isVisible().catch(() => false)) {
  await page.locator("input").nth(0).fill(auth.username);
  await page.locator("input").nth(1).fill(auth.password);
  await page.locator("text=登 录").click();
  await page.waitForTimeout(3000);
}
await page.locator("text=使用统计").first().click();
await page.waitForTimeout(2500);
await page.locator("text=使用统计与成本看板").first().waitFor({ timeout: 15000 });
const all = await page.locator("svg").all();
for (let i = 0; i < all.length; i++) {
  const b = await all[i].boundingBox();
  console.log(i, b ? `${Math.round(b.width)}x${Math.round(b.height)} @(${Math.round(b.x)},${Math.round(b.y)})` : "null");
}
await browser.close();
