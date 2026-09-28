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

let trend = null;
for (const s of await page.locator("svg").all()) {
  const b = await s.boundingBox();
  if (b && b.width > 500 && b.height > 150) { trend = s; console.log("trend box pre-scroll:", b); break; }
}
await trend.scrollIntoViewIfNeeded();
await page.waitForTimeout(400);
const box = await trend.boundingBox();
console.log("trend box post-scroll:", box);
await page.mouse.move(box.x + box.width * 0.55, box.y + box.height * 0.5);
await page.waitForTimeout(400);
const tip = await page.evaluate(() => {
  const nodes = [...document.querySelectorAll("div")];
  const hit = nodes.find((n) => n.textContent && n.textContent.startsWith("2026-") && n.style.position === "absolute");
  return hit ? hit.textContent.slice(0, 60) : null;
});
console.log("tooltip:", tip);
await page.screenshot({ path: "/root/dsh-plugin-usage-stats/.verify/ui-review/hover-trend.png" });
await browser.close();
