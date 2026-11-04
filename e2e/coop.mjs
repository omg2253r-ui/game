// Two real browser players run a co-op raid through the Worker + Durable Object.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const url = process.env.URL ?? 'http://127.0.0.1:8787/';
const out = process.env.OUT ?? 'e2e/out';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const errors = [];
async function player(name, weapon, vp) {
  const ctx = await browser.newContext({ viewport: vp });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${name} pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${name} console: ${m.text()}`); });
  await page.goto(url);
  await page.waitForSelector('#btn-new', { timeout: 60000 });
  await page.click('#btn-new');
  await page.fill('#cc-name', name);
  await page.click(`[data-weapon="${weapon}"]`);
  await page.click('#cc-start');
  await page.waitForTimeout(3000);
  return page;
}
const A = await player('Aoi', 'energy_katana', { width: 1280, height: 760 });
const B = await player('Bram', 'plasma_rifle', { width: 390, height: 844 });
log('players in city');
await A.evaluate(() => window.__game.openLobby());
await A.click('#room-create');
await A.waitForSelector('#room-code-show', { timeout: 15000 });
const code = (await A.textContent('#room-code-show')).trim();
log('room', code);
await B.evaluate(() => window.__game.openLobby());
await B.fill('#room-code', code);
await B.click('#room-join');
await B.waitForFunction(() => document.querySelectorAll('.panel .item').length >= 2, null, { timeout: 15000 });
await A.waitForFunction(() => document.querySelectorAll('.panel .item').length >= 2, null, { timeout: 15000 });
await A.click('#room-ready');
await B.click('#room-ready');
await A.waitForFunction(() => !document.querySelector('#room-start')?.disabled, null, { timeout: 15000 });
await A.screenshot({ path: `${out}/c1-lobby.png` });
await A.click('#room-start');
await Promise.all([A.waitForSelector('.b-cmd .cmd', { timeout: 30000 }), B.waitForSelector('.b-cmd .cmd', { timeout: 30000 })]);
log('raid started');
await A.waitForTimeout(800);
await A.screenshot({ path: `${out}/c2-A-plan.png` });
await B.screenshot({ path: `${out}/c2-B-plan.png` });

// Round 1: manual commands on A, B uses auto → both lock
await A.click('.cmd[data-cmd="attack"]');
await A.click('.sub-item[data-target]');
await A.click('#coop-lock');
// B sees A locked
await B.waitForFunction(() => [...document.querySelectorAll('.tag')].some((t) => t.textContent.includes('🔒')), null, { timeout: 10000 });
log('B sees A locked');
await B.click('#coop-auto');
// both receive the same server result
await A.waitForFunction(() => window.__game.battle?.state.round === 2, null, { timeout: 60000 });
await B.waitForFunction(() => window.__game.battle?.state.round === 2, null, { timeout: 60000 });
const snap = (p) => p.evaluate(() => JSON.stringify(window.__game.battle.state.units.map((u) => [u.id, u.hp, u.alive, u.statuses.map((s) => s.id).join('|')])));
const sa = await snap(A), sb = await snap(B);
log('round 2 states identical:', sa === sb);
if (sa !== sb) errors.push('STATE MISMATCH after round 1');

// Round 2: B disconnects mid-planning; A locks; server lets AI drive B's hunter; B reconnects
await A.waitForSelector('#coop-auto', { timeout: 60000 });
await B.evaluate(() => window.__coop.ws.close());
log('B socket closed');
await A.click('#coop-auto');
await A.waitForFunction(() => window.__game.battle?.state.round >= 3 || window.__game.battle?.state.phase === 'ended', null, { timeout: 60000 });
log('A resolved round 2 while B was disconnected (AI took over)');
await B.waitForFunction(() => window.__coop.status === 'open', null, { timeout: 30000 });
log('B reconnected');
await B.waitForFunction(() => (window.__game.battle?.state.round ?? 0) >= 3 || !window.__game.battle, null, { timeout: 60000 });
const ra = await A.evaluate(() => window.__game.battle?.state.round), rb = await B.evaluate(() => window.__game.battle?.state.round);
log('after reconnect rounds A/B:', ra, rb);

// Round 3: B does nothing → turn timer (30s) auto-resolves
const t0 = Date.now();
if (await A.evaluate(() => window.__game.battle?.state.phase === 'planning')) {
  await A.waitForSelector('#coop-auto', { timeout: 60000 });
  await A.click('#coop-auto');
  await A.waitForFunction((r) => (window.__game.battle?.state.round ?? 99) > r || !window.__game.battle, ra, { timeout: 70000 });
  log(`turn timer resolved idle player after ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}
await A.screenshot({ path: `${out}/c3-A-battle.png` });
await B.screenshot({ path: `${out}/c3-B-battle.png` });

// play to the end with auto on both sides
const autoLoop = async (p) => {
  const end = Date.now() + 600000;
  while (Date.now() < end) {
    if (await p.$('text=Return to Hunter City')) return 'done';
    const btn = await p.$('#coop-auto');
    if (btn) await btn.click().catch(() => {});
    await p.waitForTimeout(700);
  }
  return 'timeout';
};
const [ea, eb] = await Promise.all([autoLoop(A), autoLoop(B)]);
log('raid end', ea, eb);
await A.screenshot({ path: `${out}/c4-A-end.png` });
await B.screenshot({ path: `${out}/c4-B-end.png` });
const resText = await A.textContent('.panel');
log('result panel:', resText.replace(/\s+/g, ' ').slice(0, 220));
console.log('errors:', JSON.stringify(errors, null, 1));
await browser.close();
