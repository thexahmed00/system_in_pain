import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The sim engine is shared as TypeScript source; let Next compile it.
  transpilePackages: ["@sdq/sim-engine"],
};

export default nextConfig;
