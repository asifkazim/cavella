import type { NextConfig } from 'next';

/**
 * Static export for Cloudflare Pages (ARCHITECTURE §3, APR-02):
 * no server runtime, no API routes, no middleware.
 */
const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    // The image optimisation server is unavailable in a static export.
    unoptimized: true,
  },
  experimental: {
    // Needed for one branded 404 page with two root layouts (src/app/global-not-found.tsx).
    globalNotFound: true,
  },
};

export default nextConfig;
