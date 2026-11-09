// Copy the built SPA (apps/web/dist) into the API's public/ folder so a single
// Next.js process serves both. Used by `pnpm build:single` and the Dockerfile.
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const from = path.join(root, 'apps/web/dist');
const to = path.join(root, 'apps/api/public');
if (!fs.existsSync(path.join(from, 'index.html'))) {
  console.error('apps/web/dist is missing. Run `pnpm --filter @3d-design/web build` first.');
  process.exit(1);
}
fs.rmSync(to, { recursive: true, force: true });
fs.cpSync(from, to, { recursive: true });
console.log(`copied ${from} -> ${to}`);
