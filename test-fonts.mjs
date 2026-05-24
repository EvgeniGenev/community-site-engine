import { chromium } from 'playwright-core';

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage();
  
  await page.goto('http://localhost:4321/');
  
  const fontsCss = await page.locator('style[data-cms-fonts]').textContent();
  console.log("Fonts CSS Block:");
  console.log(fontsCss);
  
  await browser.close();
})();
