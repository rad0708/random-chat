// @ts-check
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    typedRoutes: true,
  },
  eslint: {
    dirs: ['app','components','server','lib'],
  },
  images: {
    remotePatterns: [],
  },
};
module.exports = nextConfig;
