import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  async rewrites() {
    // Use internal Docker URL when available, otherwise fall back to public URL
    const apiUrl = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
    return [
      {
        source: '/api/:path*',
        destination: `${apiUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
