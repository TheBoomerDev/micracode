import type { NextConfig } from "next";

/**
 * Headers required for StackBlitz WebContainers (Phase 3).
 *
 * COEP `require-corp` + COOP `same-origin` put the app in a
 * "cross-origin isolated" state so that `SharedArrayBuffer` is
 * available — WebContainers needs it.
 *
 * Consequence to remember:
 *   - Third-party `<img>`, `<script>`, `<iframe>` must send
 *     `Cross-Origin-Resource-Policy: cross-origin` (or be same-origin).
 */
const securityHeaders = [
  { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  // output: "export", // TEMP: removed for build compatibility - define route manually if needed
  trailingSlash: true,
  reactStrictMode: true,
  // experimental: {
  //   typedRoutes: true, // Disabled - incompatible with query string links
  // },
  transpilePackages: ["@micracode/shared", "@webcontainer/api"],
  async rewrites() {
    return [
      {
        source: "/v1/:path*",
        destination: "http://127.0.0.1:8001/v1/:path*",
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
