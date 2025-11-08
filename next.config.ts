import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "smartturjman.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "quickchart.io",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "testnet.arcscan.app",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
