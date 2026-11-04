import './styles.css';
import { Game } from './client/game';

function fail(msg: string) {
  const boot = document.getElementById('boot');
  if (boot) boot.innerHTML = `<div class="boot-logo">SCRAP<b>BOUND</b></div><p style="max-width:420px;text-align:center;color:#ff8a9a;padding:0 16px">${msg}</p>`;
}

function webglOk(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

if (!webglOk()) {
  fail('Your browser does not support WebGL. Please use a recent Chrome, Edge, Firefox or Safari.');
} else {
  const canvas = document.getElementById('view') as HTMLCanvasElement;
  const ui = document.getElementById('ui') as HTMLElement;
  try {
    const game = new Game(canvas, ui);
    game.boot().catch((e) => {
      console.error(e);
      fail('Failed to start: ' + (e as Error).message);
    });
  } catch (e) {
    console.error(e);
    fail('Failed to start: ' + (e as Error).message);
  }
}
