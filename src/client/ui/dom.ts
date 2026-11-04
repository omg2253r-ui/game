/** Tiny DOM helpers (no framework). */
type Child = Node | string | number | null | undefined | false | Child[];
type Attrs = Record<string, unknown> & { class?: string; style?: string; on?: Record<string, (e: Event) => void> };

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs | null = null, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'on') {
        for (const [ev, fn] of Object.entries(v as Record<string, (e: Event) => void>)) el.addEventListener(ev, fn);
      } else if (k === 'class') el.className = String(v);
      else if (k === 'style') el.setAttribute('style', String(v));
      else if (k === 'html') el.innerHTML = String(v);
      else if (k in el && typeof v !== 'string') (el as unknown as Record<string, unknown>)[k] = v;
      else el.setAttribute(k, v === true ? '' : String(v));
    }
  }
  append(el, children);
  return el;
}

function append(el: Node, children: Child[]) {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

export function clear(el: HTMLElement) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

export function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

export function fmt(n: number): string {
  if (!Number.isFinite(n)) return '∞';
  if (Math.abs(n) < 10000) return String(Math.round(n));
  const u = ['', 'K', 'M', 'B'];
  let i = 0;
  while (Math.abs(n) >= 1000 && i < u.length - 1) {
    n /= 1000;
    i++;
  }
  return n.toFixed(1) + u[i];
}

export function bar(cls: string, frac: number): HTMLDivElement {
  const b = h('div', { class: `bar ${cls}` }, h('i', { style: `width:${Math.max(0, Math.min(1, frac)) * 100}%` }));
  return b;
}

export function setBar(b: Element | null, frac: number) {
  const i = b?.querySelector('i') as HTMLElement | null;
  if (i) i.style.width = `${Math.max(0, Math.min(1, frac)) * 100}%`;
}

let tipEl: HTMLDivElement | null = null;
/** desktop hover tooltip */
export function tip(el: HTMLElement, html: () => string) {
  if (matchMedia('(pointer: coarse)').matches) return el;
  el.addEventListener('mouseenter', (e) => {
    tipEl ??= document.body.appendChild(h('div', { class: 'tooltip' }));
    tipEl.innerHTML = html();
    tipEl.style.display = 'block';
    pos(e as MouseEvent);
  });
  el.addEventListener('mousemove', (e) => pos(e as MouseEvent));
  el.addEventListener('mouseleave', () => tipEl && (tipEl.style.display = 'none'));
  return el;
}
function pos(e: MouseEvent) {
  if (!tipEl) return;
  const w = tipEl.offsetWidth, hh = tipEl.offsetHeight;
  tipEl.style.left = `${Math.min(window.innerWidth - w - 8, e.clientX + 14)}px`;
  tipEl.style.top = `${Math.max(8, Math.min(window.innerHeight - hh - 8, e.clientY - hh - 10))}px`;
}
export function hideTip() {
  if (tipEl) tipEl.style.display = 'none';
}
