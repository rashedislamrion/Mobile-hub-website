/** @type {import('next').NextConfig} */
if (process.env.NODE_ENV === 'production' && !process.env.NEXT_PUBLIC_API_URL) {
  console.warn(
    '\x1b[41m\x1b[37m%s\x1b[0m',
    ' [CRITICAL WARNING] NEXT_PUBLIC_API_URL is not set for production build! Requests will fallback to localhost:4000. ',
  );
}

function getSafeOrigin(urlStr) {
  if (!urlStr || typeof urlStr !== 'string') return '';
  try {
    const parsed = new URL(urlStr.startsWith('http') ? urlStr : `https://${urlStr}`);
    return parsed.origin;
  } catch {
    return '';
  }
}

function getSafeHostname(urlStr) {
  if (!urlStr || typeof urlStr !== 'string') return '';
  try {
    const parsed = new URL(urlStr.startsWith('http') ? urlStr : `https://${urlStr}`);
    return parsed.hostname;
  } catch {
    return '';
  }
}

function getSafeProtocol(urlStr) {
  if (!urlStr || typeof urlStr !== 'string') return 'https';
  try {
    const parsed = new URL(urlStr.startsWith('http') ? urlStr : `https://${urlStr}`);
    return parsed.protocol.replace(':', '');
  } catch {
    return 'https';
  }
}

const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  async headers() {
    const apiOrigin = getSafeOrigin(process.env.NEXT_PUBLIC_API_URL) || 'http://localhost:4000';
    const backendOrigin = getSafeOrigin(process.env.NEXT_PUBLIC_BACKEND_URL) || 'http://localhost:4000';
    const r2Origin = getSafeOrigin(process.env.R2_PUBLIC_URL || process.env.NEXT_PUBLIC_R2_PUBLIC_URL);

    const allowedImgSources = [
      "'self'",
      "data:",
      "blob:",
      "https:",
      backendOrigin,
      r2Origin,
    ].filter(Boolean).join(' ');

    const allowedConnectSources = [
      "'self'",
      "http://localhost:4000",
      "https:",
      "ws:",
      "wss:",
      apiOrigin,
      backendOrigin,
    ].filter(Boolean).join(' ');

    const cspDirectives = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline' https:",
      "style-src 'self' 'unsafe-inline' https:",
      `img-src ${allowedImgSources}`,
      "font-src 'self' data: https:",
      `connect-src ${allowedConnectSources}`,
      "frame-src 'self' https:",
      "frame-ancestors 'self'",
      "media-src 'self' data: blob: https:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self' https:",
    ].join('; ');

    return [
      // Private authenticated / sensitive checkout & cart routes: strictly private, no-store
      {
        source: '/admin/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'private, no-store, max-age=0',
          },
        ],
      },
      {
        source: '/account/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'private, no-store, max-age=0',
          },
        ],
      },
      {
        source: '/checkout',
        headers: [
          {
            key: 'Cache-Control',
            value: 'private, no-store, max-age=0',
          },
        ],
      },
      {
        source: '/checkout/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'private, no-store, max-age=0',
          },
        ],
      },
      {
        source: '/cart',
        headers: [
          {
            key: 'Cache-Control',
            value: 'private, no-store, max-age=0',
          },
        ],
      },
      {
        source: '/cart/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'private, no-store, max-age=0',
          },
        ],
      },
      // Global security headers for all routes
      {
        source: '/:path*',
        headers: [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'Content-Security-Policy-Report-Only',
            value: cspDirectives,
          },
        ],
      },
    ];
  },
  images: {
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'i.pravatar.cc',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'placehold.co',
        pathname: '/**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '4000',
        pathname: '/**',
      },
      {
        protocol: 'http',
        hostname: '127.0.0.1',
        port: '4000',
        pathname: '/**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        pathname: '/**',
      },
      ...(process.env.NEXT_PUBLIC_BACKEND_URL && getSafeHostname(process.env.NEXT_PUBLIC_BACKEND_URL)
        ? [
            {
              protocol: getSafeProtocol(process.env.NEXT_PUBLIC_BACKEND_URL),
              hostname: getSafeHostname(process.env.NEXT_PUBLIC_BACKEND_URL),
              pathname: '/**',
            },
          ]
        : []),
      {
        protocol: 'https',
        hostname: '**',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
