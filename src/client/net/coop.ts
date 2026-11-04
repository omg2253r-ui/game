/**
 * Co-op WebSocket client with automatic reconnection. The server (Durable Object) is
 * authoritative; this class only relays messages to the UI / battle controller.
 */
import type { ClientMsg, ServerMsg } from '../../core/net/protocol';
import { api } from './api';

type Handler = (m: ServerMsg) => void;

export class CoopClient {
  ws: WebSocket | null = null;
  code: string | null = null;
  private handlers: Handler[] = [];
  private retry = 0;
  private wantOpen = false;
  private pingTimer: number | null = null;
  status: 'idle' | 'connecting' | 'open' | 'reconnecting' | 'closed' = 'idle';
  onStatus?: (s: CoopClient['status']) => void;

  on(h: Handler) {
    this.handlers.push(h);
    return () => (this.handlers = this.handlers.filter((x) => x !== h));
  }

  private setStatus(s: CoopClient['status']) {
    this.status = s;
    this.onStatus?.(s);
  }

  connect(code: string) {
    this.code = code.toUpperCase();
    this.wantOpen = true;
    this.open();
  }

  private open() {
    if (!this.code || !api.session) return;
    this.setStatus(this.retry ? 'reconnecting' : 'connecting');
    const url = api.wsUrl(`/api/rooms/${this.code}/ws?token=${encodeURIComponent(api.session.token)}`);
    const ws = new WebSocket(url);
    this.ws = ws;
    ws.onopen = () => {
      this.retry = 0;
      this.setStatus('open');
      if (this.pingTimer) clearInterval(this.pingTimer);
      this.pingTimer = window.setInterval(() => this.send({ t: 'ping' }), 20000);
    };
    ws.onmessage = (ev) => {
      try {
        const m = JSON.parse(String(ev.data)) as ServerMsg;
        for (const h of this.handlers) h(m);
      } catch (e) {
        console.warn('bad message', e);
      }
    };
    ws.onclose = () => {
      if (this.pingTimer) clearInterval(this.pingTimer);
      if (this.ws !== ws) return;
      this.ws = null;
      if (this.wantOpen && this.retry < 8) {
        this.retry++;
        this.setStatus('reconnecting');
        setTimeout(() => this.open(), Math.min(8000, 500 * 2 ** this.retry));
      } else this.setStatus('closed');
    };
    ws.onerror = () => ws.close();
  }

  send(m: ClientMsg) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(m));
  }

  leave() {
    this.wantOpen = false;
    this.send({ t: 'leave' });
    this.ws?.close();
    this.ws = null;
    this.code = null;
    this.setStatus('idle');
  }
}

export const coop = new CoopClient();
