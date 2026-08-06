import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(__dirname),
  },
  async headers() {
    return [
      {
        // Page routes only — excludes /_next/* (content-hashed, safe to
        // cache forever — Next already forces this and it can't be
        // overridden), /api/*, and any path with a file extension (icons,
        // images, etc., which already have their own appropriate caching).
        // Next already sends `max-age=0, must-revalidate` on page HTML,
        // which is spec-correct, but browsers/proxies vary in how strictly
        // they honor that (Opera in particular routes through its own
        // compression proxy). An explicit no-store leaves no room for
        // interpretation: every browser must fetch the current HTML shell
        // on every load, so it can never reference stale/removed
        // _next/static chunk hashes from a prior deployment.
        source: "/((?!_next|api|.*\\..*).*)",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Pragma", value: "no-cache" },
          { key: "Expires", value: "0" },
        ],
      },
    ];
  },
};

export default nextConfig;
