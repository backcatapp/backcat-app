/** @type {import('next').NextConfig} */
const nextConfig = {
  // Lean Docker image: traces only the node_modules actually needed and
  // ships a standalone server.js — no full node_modules copy at runtime.
  output: "standalone",
};

export default nextConfig;
