import type { NextConfig } from "next";

import path from "node:path";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  reactCompiler: true,
  poweredByHeader: false,
  // A self-contained server bundle: the Docker image runs `.next/standalone/…/server.js`.
  output: "standalone",
  // Pin the monorepo root so workspace/`next` resolution is deterministic in Docker.
  turbopack: { root: path.join(__dirname, "..", "..") },
  outputFileTracingRoot: path.join(__dirname, "..", ".."),
  async headers() {
    return [
      // Everything except the embeddable widget refuses to be framed (clickjacking).
      {
        source: "/((?!embed).*)",
        headers: [...securityHeaders, { key: "X-Frame-Options", value: "DENY" }],
      },
      // The gallery widget is meant to be framed by any site.
      {
        source: "/embed/:path*",
        headers: [
          ...securityHeaders,
          { key: "Content-Security-Policy", value: "frame-ancestors *" },
        ],
      },
    ];
  },
};

export default nextConfig;
