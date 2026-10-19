import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Nearly every page reads the Supabase session cookie, so we use the
  // request-time rendering model rather than Cache Components for now.
  cacheComponents: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
