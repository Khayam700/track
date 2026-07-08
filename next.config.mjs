/** @type {import('next').NextConfig} */
const nextConfig = {
  // Mark better-sqlite3 as external so Next.js doesn't try to bundle
  // the native C++ addon — it must be loaded at runtime from node_modules.
  serverExternalPackages: ["better-sqlite3"],
  output: "standalone",
};

export default nextConfig;
