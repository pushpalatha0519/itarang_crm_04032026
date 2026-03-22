import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    unoptimized: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // Prevent webpack from bundling native Node modules that rely on __dirname
  // for file resolution (e.g. pdfkit needs its Helvetica.afm font files).
  serverExternalPackages: ["pdfkit", "pdf-parse"],
};

export default nextConfig;
