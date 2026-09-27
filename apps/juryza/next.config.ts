import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Emit a self-contained server bundle so the Docker runtime stage stays small
  // and starts fast — the app copies `.next/standalone` and runs `server.js`.
  output: "standalone",
};

export default nextConfig;
