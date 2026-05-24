import { chromium } from 'playwright-core';

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage();
  
  await page.goto('http://localhost:4321/events/');
  
  // Go to May 2026 where there are 3 events
  await page.click('[data-calendar-prev]');
  console.log('Month:', await page.textContent('[data-calendar-title]'));
  
  // Playwright's :visible pseudo-class uses getComputedStyle to see if it's actually visible
  console.log('Visible events in May:', await page.locator('[data-event-card]:visible').count());

  // Click on a date with an event. May 15 has 'Neighborhood Welcome Night'
  await page.click('button:has-text("15")');
  console.log('Visible events on May 15:', await page.locator('[data-event-card]:visible').count());

  // Click on a date without an event. May 16
  await page.click('button:has-text("16")');
  console.log('Visible events on May 16 (fallback to month):', await page.locator('[data-event-card]:visible').count());
  
  await browser.close();
})();
