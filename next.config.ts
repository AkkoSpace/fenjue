import type { NextConfig } from "next";

const r2PublicBaseUrl = process.env.R2_PUBLIC_BASE_URL?.replace(/\/$/, "");

const nextConfig: NextConfig = {
  cacheComponents: true,
  reactCompiler: true,
  typedRoutes: true,
  images: {
    remotePatterns: r2PublicBaseUrl
      ? [new URL(`${r2PublicBaseUrl}/**`)]
      : [],
  },
};

export default nextConfig;
