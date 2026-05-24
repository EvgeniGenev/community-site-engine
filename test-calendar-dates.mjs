import { chromium } from 'playwright-core';

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage();
  
  await page.goto('http://localhost:4321/events/');
  
  // Go to May 2026 where there are 3 events
  await page.click('[data-calendar-prev]');
  console.log('Month:', await page.textContent('[data-calendar-title]'));
  console.log('Events in May:', await page.locator('[data-event-card]:not([hidden])').count());

  // Click on a date with an event. May 15 has 'Neighborhood Welcome Night'
  // Find the button with text '15' and click it
  await page.click('button:has-text("15")');
  console.log('Events on May 15:', await page.locator('[data-event-card]:not([hidden])').count());

  // Click on a date without an event. May 16
  await page.click('button:has-text("16")');
  console.log('Events on May 16 (fallback to month):', await page.locator('[data-event-card]:not([hidden])').count());
  
  await browser.close();
})();
