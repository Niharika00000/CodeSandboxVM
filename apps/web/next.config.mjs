/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@sandbox/shared"],
  reactStrictMode: false, // avoids double-mounting the WebSocket + Monaco binding in dev
};
export default nextConfig;
