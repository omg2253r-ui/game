import fs from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';

async function freshStudio(page: Page) {
  // Skip onboarding so each test starts on the bare studio.
  await page.addInitScript(() =>
    localStorage.setItem(
      'd3-prefs',
      JSON.stringify({
        state: {
          theme: 'dark',
          locale: 'th',
          onboardingStep: 0,
          lighting: 'studio',
          autoRotate: false,
        },
        version: 1,
      }),
    ),
  );
  await page.goto('/create');
  await expect(page.getByText('เครดิต 50')).toBeVisible();
}

async function createModel(page: Page, prompt: string) {
  await page.getByLabel('คำอธิบาย').fill(prompt);
  await page.getByRole('radio', { name: 'โลว์โพลี' }).click();
  await page.getByRole('radio', { name: /ร่าง/ }).click();
  await page.getByRole('button', { name: 'สร้างโมเดล · 2 เครดิต' }).click();

  const dialog = page.getByRole('dialog', { name: 'สร้างโมเดลนี้?' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('ใช้ 2 เครดิต จากยอด 50 เครดิต เหลือ 48 เครดิต');
  await dialog.getByRole('button', { name: 'สร้างโมเดล (2 เครดิต)' }).click();

  await expect(page.getByText('เครดิต 48')).toBeVisible();
  await expect(page.getByText('สร้างโมเดลแล้ว')).toBeVisible({ timeout: 30_000 });
}

test('text-to-3D: create, inspect, download GLB, find it in the library, delete it', async ({
  page,
}) => {
  await freshStudio(page);
  await createModel(page, 'แจกันเซรามิกสีน้ำเงิน ลายทอง');

  // Inspect panel shows real mesh numbers and engine compatibility.
  await expect(page.getByText('สถิติ mesh')).toBeVisible();
  await expect(page.getByRole('term').filter({ hasText: 'สามเหลี่ยม' })).toBeVisible();
  await expect(page.getByText('Godot')).toBeVisible();

  // Download GLB: a real binary glTF with the licence embedded.
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'ดาวน์โหลด GLB' }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^model-[0-9a-z]{6}\.glb$/); // Thai name → ASCII-safe file name
  const bytes = await fs.readFile((await download.path())!);
  expect(bytes.subarray(0, 4).toString('latin1')).toBe('glTF');
  expect(bytes.toString('latin1')).toContain('3D Design Terms of Use');
  await expect(page.getByText('ดาวน์โหลด GLB แล้ว')).toBeVisible();

  // Rename, then tag it.
  const name = page.getByRole('textbox', { name: 'ชื่อโมเดล' });
  await name.fill('แจกันทดสอบ');
  await name.press('Enter');
  await expect(page.getByText('เปลี่ยนชื่อแล้ว')).toBeVisible();
  await page.getByRole('textbox', { name: 'แท็ก' }).fill('ceramic');
  await page.getByRole('textbox', { name: 'แท็ก' }).press('Enter');
  await expect(page.getByRole('button', { name: 'ลบแท็ก ceramic' })).toBeVisible();

  // Library: search and tag filter find it; delete asks first.
  await page.getByRole('link', { name: 'คลังโมเดล' }).click();
  await expect(page.getByRole('heading', { name: 'แจกันทดสอบ' })).toBeVisible();
  await page.getByRole('searchbox').fill('ไม่มีแน่นอน');
  await expect(page.getByText('ไม่พบโมเดลที่ตรงกับ')).toBeVisible();
  await page.getByRole('button', { name: 'ล้างตัวกรอง' }).click();
  await page.getByRole('button', { name: 'ceramic' }).click();
  await expect(page.getByRole('heading', { name: 'แจกันทดสอบ' })).toBeVisible();

  await page.getByRole('button', { name: 'ลบ แจกันทดสอบ' }).click();
  const confirm = page.getByRole('dialog', { name: 'ลบ "แจกันทดสอบ"?' });
  await expect(confirm.getByRole('button', { name: 'เก็บไว้' })).toBeFocused(); // safe default
  await confirm.getByRole('button', { name: 'ลบโมเดล' }).click();
  await expect(page.getByText('ลบโมเดลแล้ว')).toBeVisible();
  await expect(page.getByText('ยังไม่มีโมเดล ลองพิมพ์คำอธิบายแรกของคุณ')).toBeVisible();
});

test('share link opens a public, read-only page', async ({ page, browser }) => {
  await freshStudio(page);
  await createModel(page, 'treasure chest with gold trim');
  await page.getByRole('switch', { name: 'เปิดลิงก์แชร์' }).click();
  await expect(page.getByText('เปิดลิงก์แชร์แล้ว')).toBeVisible();
  const modelId = new URL(page.url()).searchParams.get('model')!;
  const share = await page.request.get(`/api/models/${modelId}`);
  const slug = (await share.json()).model.shareSlug as string;

  const stranger = await (await browser.newContext()).newPage();
  await stranger.goto(`/s/${slug}`);
  await expect(stranger.getByRole('heading', { name: 'Treasure chest' })).toBeVisible();
  await expect(stranger.getByText('ใช้ได้เฉพาะงานส่วนตัวที่ไม่ใช่เชิงพาณิชย์')).toBeVisible();
  // The stranger (a different guest) cannot reach the owner's private endpoints;
  // 404 rather than 403 so model ids cannot be probed.
  expect((await stranger.request.get(`/api/models/${modelId}`)).status()).toBe(404);
  expect((await stranger.request.get(`/api/models/${modelId}/file`)).status()).toBe(404);
});

test('copyrighted names are stopped before any credit is spent', async ({ page }) => {
  await freshStudio(page);
  await page.getByLabel('คำอธิบาย').fill('ตุ๊กตาปิกาจู');
  await expect(page.getByText('คำอธิบายมีชื่อที่มีลิขสิทธิ์ ("ปิกาจู")')).toBeVisible();
  await page.getByRole('button', { name: /สร้างโมเดล ·/ }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('เครดิต 50')).toBeVisible();
});

test('keyboard only: open the confirm dialog, Escape cancels without charging', async ({
  page,
}) => {
  await freshStudio(page);
  await page.getByLabel('คำอธิบาย').fill('a stone crystal cluster');
  await page.getByLabel('คำอธิบาย').press('Control+Enter');
  const dialog = page.getByRole('dialog', { name: 'สร้างโมเดลนี้?' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: /สร้างโมเดล \(/ })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(page.getByText('เครดิต 50')).toBeVisible();
});

test('the interface switches to English without losing state', async ({ page }) => {
  await freshStudio(page);
  await page.getByLabel('คำอธิบาย').fill('blue vase');
  await page.getByRole('button', { name: 'เปลี่ยนภาษาเป็นภาษาอังกฤษ' }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByLabel('Description')).toHaveValue('blue vase');
  await expect(page.getByRole('button', { name: 'Create model · 5 credits' })).toBeVisible();
});

test('consecutive generations each get fitted, measured and thumbnailed', async ({ page }) => {
  await freshStudio(page);
  await createModel(page, 'a stone crystal cluster');
  // Second run in the same session (regression: the viewer used to keep a null bounding box).
  await page.getByLabel('คำอธิบาย').fill('a wooden treasure chest');
  await page.getByRole('button', { name: 'สร้างโมเดล · 2 เครดิต' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'สร้างโมเดล (2 เครดิต)' }).click();
  await expect(page.getByText('เครดิต 46')).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'ชื่อโมเดล' })).toHaveValue(
    'Wooden treasure chest',
    { timeout: 30_000 },
  );

  await page.getByRole('button', { name: 'วัดขนาด' }).click();
  await expect(page.getByText(/^\d+ cm$/).first()).toBeVisible(); // calliper labels render

  await expect
    .poll(async () => {
      const r = await page.request.get('/api/models');
      return ((await r.json()).models as { hasThumbnail: boolean }[]).map((m) => m.hasThumbnail);
    })
    .toEqual([true, true]);
});
