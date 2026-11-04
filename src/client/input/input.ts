/**
 * Unified input: keyboard (WASD/arrows + shortcuts), mouse drag / wheel camera,
 * touch virtual joystick, touch-drag camera, pinch zoom and taps.
 */
export type TapHandler = (x: number, y: number) => void;

export class Input {
  readonly keys = new Set<string>();
  move = { x: 0, y: 0 };
  run = false;
  cam = { x: 0, y: 0 };
  zoom = 0;
  enabled = true;
  readonly touch: boolean;
  private joyEl: HTMLDivElement | null = null;
  private joyId: number | null = null;
  private joyVec = { x: 0, y: 0 };
  private drags = new Map<number, { x: number; y: number; sx: number; sy: number; t: number; moved: boolean }>();
  private pinchDist = 0;
  private keyHandlers: ((e: KeyboardEvent) => void)[] = [];
  private tapHandlers: TapHandler[] = [];
  private hoverHandlers: TapHandler[] = [];

  constructor(private canvas: HTMLCanvasElement) {
    this.touch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    window.addEventListener('keydown', (e) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      this.keys.add(e.code);
      if (['Space', 'ArrowUp', 'ArrowDown', 'Tab'].includes(e.code)) e.preventDefault();
      for (const h of this.keyHandlers) h(e);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.drags.clear();
    });
    canvas.addEventListener('pointerdown', (e) => this.down(e));
    window.addEventListener('pointermove', (e) => this.moveP(e));
    window.addEventListener('pointerup', (e) => this.up(e));
    window.addEventListener('pointercancel', (e) => this.up(e));
    canvas.addEventListener('wheel', (e) => {
      this.zoom += Math.sign(e.deltaY) * 1.2;
      e.preventDefault();
    }, { passive: false });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'mouse' && this.drags.size === 0) for (const h of this.hoverHandlers) h(e.clientX, e.clientY);
    });
  }

  onKey(h: (e: KeyboardEvent) => void) {
    this.keyHandlers.push(h);
    return () => (this.keyHandlers = this.keyHandlers.filter((x) => x !== h));
  }
  onTap(h: TapHandler) {
    this.tapHandlers.push(h);
    return () => (this.tapHandlers = this.tapHandlers.filter((x) => x !== h));
  }
  onHover(h: TapHandler) {
    this.hoverHandlers.push(h);
    return () => (this.hoverHandlers = this.hoverHandlers.filter((x) => x !== h));
  }

  private down(e: PointerEvent) {
    this.canvas.setPointerCapture?.(e.pointerId);
    this.drags.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), moved: false });
    if (this.drags.size === 2) this.pinchDist = this.pinch();
  }
  private moveP(e: PointerEvent) {
    const d = this.drags.get(e.pointerId);
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    d.x = e.clientX;
    d.y = e.clientY;
    if (Math.abs(e.clientX - d.sx) + Math.abs(e.clientY - d.sy) > 8) d.moved = true;
    if (this.drags.size === 2) {
      const p = this.pinch();
      this.zoom -= (p - this.pinchDist) * 0.04;
      this.pinchDist = p;
      return;
    }
    const k = e.pointerType === 'touch' ? 1.4 : 1;
    this.cam.x += dx * k;
    this.cam.y += dy * k;
  }
  private up(e: PointerEvent) {
    const d = this.drags.get(e.pointerId);
    if (!d) return;
    this.drags.delete(e.pointerId);
    if (!d.moved && performance.now() - d.t < 450) for (const h of this.tapHandlers) h(e.clientX, e.clientY);
  }
  private pinch() {
    const p = [...this.drags.values()];
    return Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
  }

  /** create the on-screen joystick inside a container */
  mountJoystick(parent: HTMLElement) {
    if (!this.touch) return;
    this.unmountJoystick();
    const j = document.createElement('div');
    j.className = 'joy';
    j.setAttribute('aria-label', 'Movement joystick');
    const k = document.createElement('i');
    j.appendChild(k);
    parent.appendChild(j);
    this.joyEl = j;
    const R = 50;
    const upd = (e: PointerEvent) => {
      const r = j.getBoundingClientRect();
      let x = e.clientX - (r.left + r.width / 2);
      let y = e.clientY - (r.top + r.height / 2);
      const len = Math.hypot(x, y);
      if (len > R) {
        x = (x / len) * R;
        y = (y / len) * R;
      }
      k.style.transform = `translate(${x}px, ${y}px)`;
      this.joyVec = { x: x / R, y: -y / R };
    };
    j.addEventListener('pointerdown', (e) => {
      this.joyId = e.pointerId;
      j.setPointerCapture(e.pointerId);
      upd(e);
      e.preventDefault();
      e.stopPropagation();
    });
    j.addEventListener('pointermove', (e) => {
      if (e.pointerId === this.joyId) upd(e);
    });
    const end = (e: PointerEvent) => {
      if (e.pointerId !== this.joyId) return;
      this.joyId = null;
      this.joyVec = { x: 0, y: 0 };
      k.style.transform = '';
    };
    j.addEventListener('pointerup', end);
    j.addEventListener('pointercancel', end);
  }

  unmountJoystick() {
    this.joyEl?.remove();
    this.joyEl = null;
    this.joyVec = { x: 0, y: 0 };
    this.joyId = null;
  }

  /** compute movement intent for this frame */
  poll() {
    let x = 0, y = 0;
    if (this.enabled) {
      if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) y += 1;
      if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) y -= 1;
      if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
      if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;
      x += this.joyVec.x;
      y += this.joyVec.y;
    }
    const len = Math.hypot(x, y);
    if (len > 1) {
      x /= len;
      y /= len;
    }
    this.move = { x, y };
    this.run = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') || Math.hypot(this.joyVec.x, this.joyVec.y) > 0.85;
  }

  consumeCam() {
    const c = { ...this.cam, zoom: this.zoom };
    this.cam = { x: 0, y: 0 };
    this.zoom = 0;
    return c;
  }
}
