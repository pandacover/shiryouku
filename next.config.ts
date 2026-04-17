import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  serverExternalPackages: [
    "sql.js",
    "fast-bm25",
    "chromadb",
    "@chroma-core/ai-embeddings-common",
    "@chroma-core/default-embed",
  ],
  rewrites: async () => ({
    fallback: [
      {
        source: "/((?!api/).*)",
        destination: "/static-shell-app",
      },
    ],
  }),
};

export default nextConfig;
