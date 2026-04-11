import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "www.onepiece-cardgame.com"
      }
    ]
  }
};

export default nextConfig;
