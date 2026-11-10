import { expect, test } from '@playwright/test';

test('mobile: viewer on top, controls in tabs, sticky create button, no horizontal scroll', async ({
  page,
}) => {
  await page.goto('/create');
  const viewer = page.getByRole('application', { name: /มุมมองโมเดล/ });
  const tabs = page.getByRole('tablist', { name: 'แผงควบคุม' });
  await expect(viewer).toBeVisible();
  await expect(tabs).toBeVisible();
  const vb = (await viewer.boundingBox())!;
  const tb = (await tabs.boundingBox())!;
  expect(vb.y).toBeLessThan(tb.y);

  await expect(page.getByRole('button', { name: /สร้างโมเดล ·/ })).toBeInViewport();
  await page.getByRole('tab', { name: 'ส่งออก' }).click();
  await expect(page.getByText('สถิติและการส่งออกจะแสดงที่นี่หลังสร้างโมเดล')).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
