import type { NextConfig } from "next";

// Server-side only — not exposed to the browser
const API_URL = process.env.API_URL || "https://api.mail.reclear.io";

const nextConfig: NextConfig = {
  output: "standalone",
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${API_URL}/api/:path*`,
      },
    ];
  },
};
export default nextConfig;
