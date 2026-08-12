import type { NextConfig } from "next";

const distDir = process.env.NEXT_BUILD_DIST_DIR?.trim() || undefined;

const nextConfig: NextConfig = {
  ...(distDir ? { distDir } : {}),
  experimental: {
    serverActions: {
      bodySizeLimit: "15mb",
    },
  },
};

export default nextConfig;
