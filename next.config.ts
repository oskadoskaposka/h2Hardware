import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  images: {
    unoptimized: true,
  },
  // opcional, mas ajuda o Firebase + rotas estáticas
  trailingSlash: true,
};

export default nextConfig;
