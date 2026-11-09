import type { NextConfig } from 'next';

const security = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
];

const config: NextConfig = {
  // In development this app only serves /api/* and Vite serves the UI.
  // In single-service deploys (Dockerfile), the built UI is copied into
  // ./public and served from here too: see the fallback rewrite below.
  transpilePackages: ['@3d-design/shared'],
  serverExternalPackages: ['bullmq', 'ioredis', 'pg'],
  poweredByHeader: false,
  async headers() {
    return [
      { source: '/api/:path*', headers: security },
      { source: '/:path*', headers: [...security, { key: 'X-Frame-Options', value: 'DENY' }] },
      // Vite fingerprints everything in /assets, so it can be cached forever.
      {
        source: '/assets/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ];
  },
  async rewrites() {
    return {
      beforeFiles: [],
      afterFiles: [],
      // Client-side routes (/create, /library, /s/…) fall back to the SPA shell.
      // Fallbacks run only after /api routes and real files have been tried.
      fallback: [{ source: '/:path((?!api/).*)', destination: '/index.html' }],
    };
  },
};

export default config;
