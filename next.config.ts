import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: [],
  experimental: {
    proxyClientMaxBodySize: "8gb"
  }
};

export default nextConfig;
