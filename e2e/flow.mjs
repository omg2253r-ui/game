// Plays a real single-player flow in headless Chromium: create hunter → city → dungeon → battle (manual commands then auto) → loot.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const url = process.env.URL ?? 'http://localhost:5173/';
const out = process.env.OUT ?? 'e2e/out';
const vp = process.env.MOBILE ? { width: 390, height: 844 } : { width: 1280, height: 760 };
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: vp, hasTouch: !!process.env.MOBILE, isMobile: !!process.env.MOBILE });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('502') && !m.text().includes('Failed to load resource')) errors.push('console: ' + m.text()); });
const tag = process.env.MOBILE ? 'm-' : '';
await page.goto(url);
await page.waitForSelector('#btn-new', { timeout: 30000 });
await page.click('#btn-new');
await page.waitForSelector('#cc-name');
await page.fill('#cc-name', 'Akira');
await page.click('[data-weapon="energy_katana"]');
await page.waitForTimeout(600);
await page.screenshot({ path: `${out}/${tag}02-creator.png` });
await page.click('#cc-start');
await page.waitForTimeout(2500);
await page.screenshot({ path: `${out}/${tag}03-city.png` });
// walk a bit with keyboard
if (!process.env.MOBILE) {
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(900);
  await page.keyboard.up('KeyW');
}
await page.evaluate(() => window.__game.startDungeon('data_center', 0));
await page.waitForTimeout(2500);
await page.screenshot({ path: `${out}/${tag}04-dungeon.png` });
// start the first combat encounter
await page.evaluate(() => {
  const g = window.__game;
  const room = g.layout.rooms.find((r) => r.type === 'combat' && r.encounters.length);
  g.startBattle(room.encounters[0], `${room.id}:0`);
});
await page.waitForSelector('.b-cmd .cmd', { timeout: 20000 });
await page.waitForTimeout(1200);
await page.screenshot({ path: `${out}/${tag}05-battle-plan.png` });
// manual: hunter 1 uses Skill on first target, hunter 2 Scan, hunter 3 Attack
await page.click('.cmd[data-cmd="skill"]');
await page.click('.sub-item[data-skill]');
await page.screenshot({ path: `${out}/${tag}06-target.png` });
await page.click('.sub-item[data-target]');
await page.click('.cmd[data-cmd="scan"]');
await page.click('.sub-item[data-target]');
await page.click('.cmd[data-cmd="attack"]');
await page.click('.sub-item[data-target]');
await page.waitForTimeout(1800);
await page.screenshot({ path: `${out}/${tag}07-battle-anim.png` });
await page.waitForSelector('.b-cmd .cmd', { timeout: 60000 });
await page.screenshot({ path: `${out}/${tag}08-round2.png` });
// auto battle to the end
await page.click('#b-auto');
await page.click('#b-speed');
await page.click('#b-speed');
await page.waitForSelector('#loot-ok', { timeout: 180000 });
await page.waitForTimeout(500);
await page.screenshot({ path: `${out}/${tag}09-loot.png` });
await page.click('#loot-ok');
await page.waitForTimeout(1200);
await page.screenshot({ path: `${out}/${tag}10-after.png` });
const save = await page.evaluate(() => JSON.parse(localStorage.getItem('scrapbound.save.v2')));
console.log(JSON.stringify({ credits: save.credits, inv: save.inventory.length, kills: save.stats.kills, battles: save.stats.battles, wins: save.stats.wins, lvl: save.hunters.map((h) => h.level + ':' + h.exp) }));
console.log('errors:', JSON.stringify(errors, null, 1));
await browser.close();
