import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Allow server-only dependencies to not be bundled
  serverExternalPackages: ["@libsql/client"],
};

export default nextConfig;
