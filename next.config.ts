import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
  serverExternalPackages: ["pdf-parse", "cheerio"],
  allowedDevOrigins: ["10.0.0.22"],
};

export default nextConfig;
