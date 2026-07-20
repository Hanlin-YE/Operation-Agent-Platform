/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep verification builds separate from a running `next dev` instance.
  // `npm run build:verify` sets NEXT_DIST_DIR=.next-verify, preventing a
  // production build from deleting hot-reload chunks in the active `.next`.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  experimental: {
    serverActions: {
      allowedOrigins: ["localhost:3000", "127.0.0.1:3000"]
    }
  }
};

export default nextConfig;
