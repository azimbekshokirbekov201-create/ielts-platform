import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  poweredByHeader: false,
  allowedDevOrigins: ["127.0.0.1"],
  experimental: { cpus: 2 },
  devIndicators: false,
};
export default nextConfig;
