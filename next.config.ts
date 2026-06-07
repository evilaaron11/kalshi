import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit a self-contained server bundle (.next/standalone) for a lean container image.
  output: "standalone",
  // The gateway client is server-only (uses node:child_process for local fallback) — keep
  // it external so Next doesn't try to bundle it.
  serverExternalPackages: ["@evilaaron11/claude-gateway-client"],
};

export default nextConfig;
