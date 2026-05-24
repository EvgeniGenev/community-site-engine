import { chromium } from 'playwright-core';

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));

  await page.goto('http://localhost:4321/events/');
  
  console.log('Initial Month:', await page.textContent('[data-calendar-title]'));
  console.log('Initial Events count:', await page.locator('[data-event-card]:not([hidden])').count());

  await page.click('[data-calendar-prev]');
  console.log('After Prev Month:', await page.textContent('[data-calendar-title]'));
  console.log('After Prev Events count:', await page.locator('[data-event-card]:not([hidden])').count());

  await page.click('[data-calendar-next]');
  console.log('After Next Month:', await page.textContent('[data-calendar-title]'));
  
  await browser.close();
})();
