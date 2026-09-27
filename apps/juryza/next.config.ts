import type { NextConfig } from "next";

import path from "node:path";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Emit a self-contained server bundle so the Docker runtime stage stays small
  // and starts fast — the app copies `.next/standalone` and runs `server.js`.
  output: "standalone",
  // Pin the monorepo root so Turbopack's workspace/`next` resolution is
  // deterministic in Docker (where cwd and lockfile location can otherwise be
  // misinferred). Two levels up from apps/juryza is the repo root.
  turbopack: {
    root: path.join(__dirname, "..", ".."),
  },
  // The standalone tracer must also start from the repo root to bundle the
  // hoisted workspace dependencies (Bun keeps them at the root node_modules).
  outputFileTracingRoot: path.join(__dirname, "..", ".."),
};

export default nextConfig;
