// Runs every browser test. Single-player tests need `npm run dev` (port 5173);
// the co-op test needs `npm run build && npm run db:migrate:local && npm run dev:server` (port 8787).
import { execFileSync } from 'child_process';
import { mkdirSync } from 'fs';
mkdirSync('e2e/out', { recursive: true });
const runs = [
  ['desktop flow', 'e2e/flow.mjs', {}],
  ['mobile portrait flow', 'e2e/flow.mjs', { MOBILE: '1' }],
  ['boss + mobile landscape showcase', 'e2e/showcase.mjs', {}],
];
if (process.env.COOP !== '0') runs.push(['2-player co-op raid', 'e2e/coop.mjs', {}], ['resume + cloud save', 'e2e/resume.mjs', {}]);
let failed = 0;
for (const [name, file, env] of runs) {
  process.stdout.write(`\n=== ${name} ===\n`);
  try {
    const out = execFileSync('node', [file], { env: { ...process.env, ...env }, encoding: 'utf8', timeout: 900000 });
    process.stdout.write(out);
    if (!/errors: \[\]/.test(out)) failed++;
  } catch (e) {
    failed++;
    process.stdout.write(String(e.stdout ?? '') + String(e.message));
  }
}
console.log(`\n${runs.length - failed}/${runs.length} browser suites passed`);
process.exit(failed ? 1 : 0);
