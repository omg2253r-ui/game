import { h, clear } from './dom';
import { audio } from '../audio/audio';

/** Core UI services: layers, panels, toasts, banners, transitions. */
export class Ui {
  readonly layer: HTMLElement;
  readonly hudLayer: HTMLDivElement;
  private toasts: HTMLDivElement;
  private overlay: HTMLDivElement | null = null;
  private fadeEl: HTMLDivElement;
  onPanelClose?: () => void;
  panelOpen = false;
  private panelStack: (() => void)[] = [];

  constructor(root: HTMLElement) {
    this.layer = root;
    this.hudLayer = h('div', { class: 'pass' });
    this.layer.appendChild(this.hudLayer);
    this.toasts = h('div', { class: 'toasts' });
    document.body.appendChild(this.toasts);
    this.fadeEl = h('div', { class: 'fade' });
    document.body.appendChild(this.fadeEl);
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' && this.panelOpen) {
        e.stopImmediatePropagation();
        this.closePanel();
      }
    }, true);
  }

  toast(text: string, kind: '' | 'good' | 'bad' | 'gold' = '') {
    const t = h('div', { class: `toast ${kind}` }, text);
    this.toasts.appendChild(t);
    while (this.toasts.childElementCount > 4) this.toasts.firstElementChild?.remove();
    setTimeout(() => t.remove(), 3300);
  }

  banner(text: string, color = '#fff', sub?: string) {
    document.querySelectorAll('.banner').forEach((b) => b.remove());
    const b = h('div', { class: 'banner', style: `color:${color}` }, text, sub ? h('small', null, sub) : null);
    document.body.appendChild(b);
    setTimeout(() => b.remove(), 1400);
  }

  flash() {
    const f = h('div', { class: 'flash' });
    document.body.appendChild(f);
    setTimeout(() => f.remove(), 500);
  }

  async fade(fn: () => void | Promise<void>) {
    this.fadeEl.classList.add('on');
    await new Promise((r) => setTimeout(r, 360));
    await fn();
    await new Promise((r) => setTimeout(r, 60));
    this.fadeEl.classList.remove('on');
  }

  /** open a modal panel; returns body element for content */
  panel(title: string, opts: { narrow?: boolean; onClose?: () => void; tabs?: { id: string; label: string }[]; tab?: string; onTab?: (id: string) => void; className?: string } = {}): { body: HTMLDivElement; root: HTMLDivElement; close: () => void; setTitle: (t: string) => void } {
    this.closePanel(true);
    audio.sfx('click');
    const body = h('div', { class: 'panel-b' });
    const titleEl = h('h2', null, title);
    const head = h('div', { class: 'panel-h' }, titleEl, h('button', { class: 'btn ghost x', 'aria-label': 'Close', on: { click: () => this.closePanel() } }, '✕'));
    const panel = h('div', { class: `panel ${opts.narrow ? 'narrow' : ''} ${opts.className ?? ''}`, role: 'dialog', 'aria-label': title });
    panel.append(head);
    if (opts.tabs) {
      const tabs = h('div', { class: 'tabs' });
      for (const t of opts.tabs) {
        tabs.append(h('button', { class: `btn ${t.id === opts.tab ? 'on' : ''}`, 'data-tab': t.id, on: { click: () => { audio.sfx('click'); opts.onTab?.(t.id); } } }, t.label));
      }
      panel.append(tabs);
    }
    panel.append(body);
    const ov = h('div', { class: 'overlay', on: { pointerdown: (e) => { if (e.target === ov) this.closePanel(); } } });
    ov.appendChild(panel);
    this.layer.appendChild(ov);
    this.overlay = ov;
    this.panelOpen = true;
    if (opts.onClose) this.panelStack.push(opts.onClose);
    return { body, root: panel, close: () => this.closePanel(), setTitle: (t) => (titleEl.textContent = t) };
  }

  closePanel(silent = false) {
    if (!this.overlay) return;
    this.overlay.remove();
    this.overlay = null;
    this.panelOpen = false;
    const cb = this.panelStack.pop();
    this.panelStack = [];
    if (!silent) {
      audio.sfx('back');
      cb?.();
      this.onPanelClose?.();
    }
  }

  clearHud() {
    clear(this.hudLayer);
  }

  confirm(title: string, text: string, ok = 'Confirm', danger = false): Promise<boolean> {
    return new Promise((res) => {
      const p = this.panel(title, { narrow: true, onClose: () => res(false) });
      p.body.append(h('p', null, text), h('div', { class: 'row' },
        h('button', { class: `btn ${danger ? 'danger' : 'pri'} grow`, on: { click: () => { this.closePanel(true); res(true); } } }, ok),
        h('button', { class: 'btn ghost grow', on: { click: () => { this.closePanel(true); res(false); } } }, 'Cancel')));
    });
  }
}
