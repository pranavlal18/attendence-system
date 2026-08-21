import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: '/(auth)/login', destination: '/login', permanent: false },
      { source: '/(auth)/login/:path*', destination: '/login', permanent: false },
    ];
  },
};

export default nextConfig;
