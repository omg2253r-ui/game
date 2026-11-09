import type { NextConfig } from 'next';

const config: NextConfig = {
  // This app only serves /api/*. The UI lives in apps/web.
  transpilePackages: ['@3d-design/shared'],
  serverExternalPackages: ['bullmq', 'ioredis', 'pg'],
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

export default config;
