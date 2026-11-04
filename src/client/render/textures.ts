import * as THREE from 'three';

const cache = new Map<string, THREE.Texture>();

function canvasTex(key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, opts: { repeat?: boolean; shared?: boolean } = {}): THREE.CanvasTexture {
  const hit = cache.get(key) as THREE.CanvasTexture | undefined;
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  draw(g);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (opts.repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
  }
  if (opts.shared !== false) {
    t.userData.shared = true;
    cache.set(key, t);
  }
  return t;
}

/** big anime eye with iris gradient and highlights */
export function eyeTexture(iris: string): THREE.Texture {
  return canvasTex(`eye${iris}`, 128, 128, (g) => {
    g.clearRect(0, 0, 128, 128);
    // sclera
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.ellipse(64, 70, 46, 54, 0, 0, Math.PI * 2);
    g.fill();
    // iris
    const grad = g.createLinearGradient(0, 24, 0, 120);
    grad.addColorStop(0, '#111');
    grad.addColorStop(0.35, iris);
    grad.addColorStop(1, '#ffffff');
    g.fillStyle = grad;
    g.beginPath();
    g.ellipse(64, 74, 36, 46, 0, 0, Math.PI * 2);
    g.fill();
    // pupil
    g.fillStyle = '#05060a';
    g.beginPath();
    g.ellipse(64, 70, 16, 24, 0, 0, Math.PI * 2);
    g.fill();
    // lash line
    g.strokeStyle = '#1a1020';
    g.lineWidth = 12;
    g.beginPath();
    g.ellipse(64, 70, 46, 54, 0, Math.PI * 1.08, Math.PI * 1.92);
    g.stroke();
    // highlights
    g.fillStyle = 'rgba(255,255,255,0.95)';
    g.beginPath();
    g.ellipse(48, 50, 12, 15, -0.3, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.ellipse(80, 96, 6, 7, 0, 0, Math.PI * 2);
    g.fill();
  });
}

export function mouthTexture(): THREE.Texture {
  return canvasTex('mouth', 64, 32, (g) => {
    g.strokeStyle = '#5a2a30';
    g.lineWidth = 5;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(18, 12);
    g.quadraticCurveTo(32, 24, 46, 12);
    g.stroke();
  });
}

export function signTexture(text: string, color: string, sub = ''): THREE.Texture {
  return canvasTex(`sign${text}${color}${sub}`, 512, 128, (g) => {
    g.fillStyle = 'rgba(5,8,18,0.92)';
    g.fillRect(0, 0, 512, 128);
    g.strokeStyle = color;
    g.lineWidth = 6;
    g.strokeRect(6, 6, 500, 116);
    g.shadowColor = color;
    g.shadowBlur = 18;
    g.fillStyle = color;
    g.font = 'bold 56px "Segoe UI", system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, 256, sub ? 52 : 66);
    if (sub) {
      g.shadowBlur = 6;
      g.font = '24px "Segoe UI", system-ui, sans-serif';
      g.fillStyle = '#e8f0ff';
      g.fillText(sub, 256, 100);
    }
  });
}

export function windowsTexture(color: string, seed = 1): THREE.Texture {
  return canvasTex(`win${color}${seed}`, 128, 256, (g) => {
    g.fillStyle = '#0d1222';
    g.fillRect(0, 0, 128, 256);
    let s = seed * 9301;
    const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    for (let y = 8; y < 256; y += 18) {
      for (let x = 8; x < 128; x += 20) {
        const on = rnd() > 0.45;
        g.fillStyle = on ? (rnd() > 0.7 ? color : '#ffe9b0') : '#1a2236';
        g.globalAlpha = on ? 0.55 + rnd() * 0.45 : 1;
        g.fillRect(x, y, 12, 10);
      }
    }
    g.globalAlpha = 1;
  }, { repeat: true });
}

export function gridTexture(line: string, bg: string, cells = 8): THREE.Texture {
  return canvasTex(`grid${line}${bg}${cells}`, 256, 256, (g) => {
    g.fillStyle = bg;
    g.fillRect(0, 0, 256, 256);
    const step = 256 / cells;
    g.strokeStyle = line;
    g.globalAlpha = 0.35;
    g.lineWidth = 2;
    for (let i = 0; i <= cells; i++) {
      g.beginPath();
      g.moveTo(i * step, 0);
      g.lineTo(i * step, 256);
      g.stroke();
      g.beginPath();
      g.moveTo(0, i * step);
      g.lineTo(256, i * step);
      g.stroke();
    }
    g.globalAlpha = 0.08;
    g.fillStyle = line;
    for (let i = 0; i < 40; i++) g.fillRect(Math.random() * 256, Math.random() * 256, step * 0.9, step * 0.9);
    g.globalAlpha = 1;
  }, { repeat: true });
}

export function panelTexture(base: string, accent: string): THREE.Texture {
  return canvasTex(`panel${base}${accent}`, 128, 128, (g) => {
    g.fillStyle = base;
    g.fillRect(0, 0, 128, 128);
    g.strokeStyle = 'rgba(0,0,0,0.45)';
    g.lineWidth = 3;
    g.strokeRect(2, 2, 124, 124);
    g.strokeRect(2, 64, 124, 1);
    g.fillStyle = accent;
    g.globalAlpha = 0.65;
    g.fillRect(10, 54, 30, 4);
    g.fillRect(88, 116, 30, 4);
    g.globalAlpha = 0.25;
    for (let i = 0; i < 6; i++) g.fillRect(70 + i * 8, 14, 4, 30);
    g.globalAlpha = 1;
  }, { repeat: true });
}

export function radialTexture(): THREE.Texture {
  return canvasTex('radial', 64, 64, (g) => {
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.35, 'rgba(255,255,255,0.55)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
  });
}

export function skyTexture(top: string, bottom: string): THREE.Texture {
  return canvasTex(`sky${top}${bottom}`, 16, 256, (g) => {
    const grd = g.createLinearGradient(0, 0, 0, 256);
    grd.addColorStop(0, top);
    grd.addColorStop(1, bottom);
    g.fillStyle = grd;
    g.fillRect(0, 0, 16, 256);
  });
}
