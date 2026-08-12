import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: "build",
  experimental: {
    serverActions: {
      bodySizeLimit: "15mb",
    },
  },
};

export default nextConfig;
