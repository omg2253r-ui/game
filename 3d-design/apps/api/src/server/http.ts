import { NextResponse } from 'next/server';
import type { ApiError } from '@3d-design/shared';
import { ZodError, type ZodType } from 'zod';
import { AppError } from './types';

export function errorResponse(e: unknown): NextResponse<ApiError> {
  if (e instanceof AppError) {
    const headers: Record<string, string> = {};
    if (e.code === 'rate_limited' && e.detail?.retryAfter) {
      headers['Retry-After'] = String(e.detail.retryAfter);
    }
    return NextResponse.json(
      { error: { code: e.code, ...(e.detail && { detail: e.detail }) } },
      { status: e.status, headers },
    );
  }
  if (e instanceof ZodError) {
    const first = e.issues[0];
    return NextResponse.json(
      {
        error: {
          code: 'invalid_request',
          detail: { field: first?.path.join('.') ?? '', issue: first?.code ?? 'invalid' },
        },
      },
      { status: 400 },
    );
  }
  console.error('[api] unhandled error', e);
  return NextResponse.json({ error: { code: 'internal' } }, { status: 500 });
}

/** Wrap a route handler so every thrown error becomes a typed ApiError. */
export function route<A extends unknown[]>(
  fn: (...args: A) => Promise<Response>,
): (...args: A) => Promise<Response> {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (e) {
      return errorResponse(e);
    }
  };
}

export async function readJson<T>(req: Request, schema: ZodType<T>, maxBytes = 16_384): Promise<T> {
  const len = Number(req.headers.get('content-length') ?? 0);
  if (len > maxBytes) throw new AppError('payload_too_large', 413, { maxBytes });
  const text = await req.text();
  if (text.length > maxBytes) throw new AppError('payload_too_large', 413, { maxBytes });
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw new AppError('invalid_request', 400, { field: '', issue: 'json' });
  }
  return schema.parse(body);
}

/** Same-origin check for state-changing requests (cookie auth => CSRF risk). */
export function assertSameOrigin(req: Request): void {
  const origin = req.headers.get('origin');
  if (!origin) return; // non-browser clients; cookie is SameSite=Lax anyway
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  try {
    if (new URL(origin).host === host) return;
  } catch {
    /* fallthrough */
  }
  throw new AppError('forbidden', 403, { reason: 'origin' });
}

/**
 * Client IP for rate limiting. Next.js appends the socket address to
 * X-Forwarded-For, so the last entry is the direct peer. Behind a proxy you
 * control (TRUST_PROXY=true) the first entry is the original client.
 */
export function clientIp(req: Request, trustProxy: boolean): string {
  const cf = req.headers.get('cf-connecting-ip');
  if (trustProxy && cf) return cf;
  const chain = (req.headers.get('x-forwarded-for') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return (trustProxy ? chain[0] : chain.at(-1)) ?? 'unknown';
}
