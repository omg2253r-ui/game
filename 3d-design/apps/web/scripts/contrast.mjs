/**
 * WCAG 2.2 contrast check for the token pairs the UI actually uses.
 * Reads src/styles/tokens.css so the numbers can never drift from the code.
 *   pnpm --filter @3d-design/web contrast
 */
import fs from 'node:fs';

const css = fs.readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8');
const block = (selector) => {
  const start = css.indexOf(selector);
  const body = css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start));
  return Object.fromEntries(
    [...body.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1], m[2]]),
  );
};
const themes = { dark: block("[data-theme='dark']"), light: block("[data-theme='light']") };

const lum = (hex) => {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

// [foreground, background, minimum, what]
const PAIRS = [
  ['text', 'bg', 4.5, 'body text on page'],
  ['text', 'surface', 4.5, 'text in panels'],
  ['text', 'surface-2', 4.5, 'text in inputs'],
  ['text', 'viewer', 4.5, 'empty-state text on viewer'],
  ['text-muted', 'bg', 4.5, 'secondary text on page'],
  ['text-muted', 'surface', 4.5, 'secondary text in panels'],
  ['text-muted', 'surface-2', 4.5, 'placeholder / hints in inputs'],
  ['on-accent', 'accent', 4.5, 'primary button label'],
  ['accent-ink', 'surface', 4.5, 'measurement readouts'],
  ['accent-ink', 'bg', 3, 'focus ring on page (non-text)'],
  ['accent-ink', 'surface', 3, 'focus ring in panels (non-text)'],
  ['danger', 'surface', 4.5, 'error text'],
  ['bg', 'danger', 4.5, 'danger button label'],
  ['ok', 'surface', 4.5, 'ready badge'],
  ['line-strong', 'surface-2', 3, 'input border vs fill (non-text)'],
  ['line-strong', 'surface', 3, 'switch / radio outline (non-text)'],
  ['viewer-ink', 'viewer', 3, 'turntable ticks (non-text)'],
];

let failed = 0;
for (const [name, t] of Object.entries(themes)) {
  console.log(`\n${name}`);
  for (const [fg, bg, min, what] of PAIRS) {
    const r = ratio(t[fg], t[bg]);
    const ok = r >= min;
    if (!ok) failed++;
    console.log(
      `  ${ok ? 'pass' : 'FAIL'}  ${r.toFixed(2).padStart(5)} ≥ ${min}  ${fg} on ${bg}  (${what})`,
    );
  }
}
console.log(failed ? `\n${failed} pair(s) below WCAG AA` : '\nall pairs meet WCAG AA');
process.exit(failed ? 1 : 0);
