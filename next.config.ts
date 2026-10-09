import type { NextConfig } from "next";

const e2eDistDir = process.env.FINCH_E2E_NEXT_DIST_DIR;
if (e2eDistDir !== undefined && e2eDistDir !== ".next-e2e") {
  throw new Error("FINCH_E2E_NEXT_DIST_DIR must be .next-e2e when set.");
}

const nextConfig: NextConfig = {
  ...(e2eDistDir ? { distDir: e2eDistDir, agentRules: false } : {}),
};

export default nextConfig;
