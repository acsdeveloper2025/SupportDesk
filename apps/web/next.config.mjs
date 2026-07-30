import path from "node:path";

/** @type {import("next").NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  outputFileTracingRoot: path.join(import.meta.dirname, "../.."),
  reactStrictMode: true,
  transpilePackages: ["@supportdesk/ui", "@supportdesk/config"],
};

export default nextConfig;
