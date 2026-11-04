// Boss fight visuals: phase change, team ultimate, reactions, ultimate cut-in; mobile landscape with real taps.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');
const url = process.env.URL ?? 'http://localhost:5173/';
const out = process.env.OUT ?? 'e2e/out';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];
async function setup(ctxOpts, tag) {
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${tag} pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(`${tag} console: ${m.text()}`); });
  await page.goto(url);
  await page.waitForSelector('#btn-new', { timeout: 60000 });
  await page.click('#btn-new');
  await page.fill('#cc-name', 'Mika');
  await page.click('[data-weapon="photon_scythe"]');
  await page.click('#cc-start');
  await page.waitForTimeout(2000);
  return page;
}
// --- desktop boss showcase ---
const page = await setup({ viewport: { width: 1280, height: 760 } }, 'desk');
await page.evaluate(async () => {
  const g = window.__game;
  const s = g.store.s;
  for (const h of s.hunters) { h.level = 8; }
  await g.startDungeon('data_center', 0);
});
await page.waitForTimeout(2000);
await page.evaluate(() => {
  const g = window.__game;
  const room = g.layout.rooms[g.layout.bossRoom];
  g.startBattle(room.encounters[0], `${room.id}:0`);
});
await page.waitForSelector('.b-cmd .cmd', { timeout: 20000 });
await page.waitForTimeout(1000);
await page.screenshot({ path: `${out}/s1-boss-intro.png` });
// round 1: defend vs drone summon; show telegraph
await page.click('.cmd[data-cmd="defend"]');
await page.click('.cmd[data-cmd="scan"]');
await page.click('.sub-item[data-target]');
await page.click('.cmd[data-cmd="defend"]');
await page.waitForTimeout(2600);
await page.screenshot({ path: `${out}/s2-boss-summon.png` });
await page.waitForSelector('.b-cmd .cmd', { timeout: 60000 });
await page.screenshot({ path: `${out}/s3-boss-shield.png` });
// force full gauges to showcase ultimate + team ultimate
await page.evaluate(() => { const b = window.__game.battle; b.state.teamGauge = 100; for (const u of b.state.units) if (u.side === 'ally') u.ult = 100; b['renderAll'](); });
await page.click('.cmd[data-cmd="ultimate"]');
await page.waitForTimeout(100);
await page.click('.cmd[data-cmd="team_ult"]').catch(() => {});
await page.waitForTimeout(100);
const remaining = await page.$('.cmd[data-cmd="attack"]');
if (remaining) { await page.click('.cmd[data-cmd="attack"]'); await page.click('.sub-item[data-target]'); }
await page.waitForTimeout(1000);
await page.screenshot({ path: `${out}/s4-ultimate.png` });
await page.waitForTimeout(2500);
await page.screenshot({ path: `${out}/s5-team-ult.png` });
await page.waitForSelector('.b-cmd .cmd, #loot-ok', { timeout: 90000 });
await page.screenshot({ path: `${out}/s6-after.png` });

// --- mobile landscape with taps ---
const m = await setup({ ...devices['Pixel 7 landscape'] }, 'mob');
await m.evaluate(() => window.__game.startDungeon('data_center', 0));
await m.waitForTimeout(2000);
await m.screenshot({ path: `${out}/s7-mobile-land-dungeon.png` });
await m.evaluate(() => { const g = window.__game; const room = g.layout.rooms.find((r) => r.type === 'combat' && r.encounters.length); g.startBattle(room.encounters[0], `${room.id}:0`); });
await m.waitForSelector('.b-cmd .cmd', { timeout: 20000 });
await m.waitForTimeout(800);
await m.screenshot({ path: `${out}/s8-mobile-land-battle.png` });
await m.tap('.cmd[data-cmd="attack"]');
await m.tap('.sub-item[data-target]');
await m.tap('.cmd[data-cmd="skill"]');
await m.tap('.sub-item[data-skill]');
await m.waitForTimeout(300);
await m.screenshot({ path: `${out}/s9-mobile-land-skill.png` });
// tap the enemy name label in 3D space instead of the list
const lab = await m.$('.unit-label.targetable');
if (lab) await lab.tap(); else await m.tap('.sub-item[data-target]');
await m.tap('.cmd[data-cmd="defend"]');
await m.waitForSelector('.b-status', { timeout: 10000 });
const resolving = await m.textContent('.b-status');
console.log('mobile tap flow reached:', resolving.trim().slice(0, 40));
console.log('errors:', JSON.stringify(errors, null, 1));
await browser.close();
