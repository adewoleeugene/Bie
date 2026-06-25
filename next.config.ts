import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: ".",
  },
  experimental: {
    // Editor file uploads + wiki autosave go through Server Actions; the
    // default 1 MB body cap rejects larger files/pages.
    serverActions: {
      bodySizeLimit: "15mb",
    },
  },
};

export default nextConfig;
