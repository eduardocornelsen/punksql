/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  // sql.js WASM loads from CDN, no special webpack config needed
};

module.exports = nextConfig;
