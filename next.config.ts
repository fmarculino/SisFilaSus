import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    '/api/esus-agent/tray-version': ['./apps/sisfilasus-agent/dist/**/*', './apps/sisfilasus-agent/*'],
    '/api/esus-agent/tray-download': ['./apps/sisfilasus-agent/dist/**/*', './apps/sisfilasus-agent/*'],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
    proxyClientMaxBodySize: "50mb",
  },
};

export default nextConfig;
