/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    // Bypass Vercel's metered image transformations. Uploaded product media is
    // processed before storage, so serve the source image URLs directly.
    unoptimized: true,
    // Keep Next's image optimizer limited to the Supabase Storage projects
    // currently serving public site media in the BD and IN branches.
    remotePatterns: [
      'ufxsthshyebahkwbmioe.supabase.co',
      'avnxyrvynqtxbzgffxve.supabase.co',
      'afwshccobrpdhzcwtgvs.supabase.co',
    ].map((hostname) => ({
      protocol: 'https',
      hostname,
      pathname: '/storage/v1/object/public/**',
    })),
  },
  experimental: { cpus: 1, inlineCss: true },
  webpack: (config) => {
    config.parallelism = 1;
    config.resolve.alias = {
      ...config.resolve.alias,
      // GAZI SEED targets modern browsers (Chrome 111+, Edge 111+, Firefox 111+, Safari 16.4+).
      // Next.js otherwise bundles its legacy polyfill-module into the shared client runtime.
      '../build/polyfills/polyfill-module': false,
      'next/dist/build/polyfills/polyfill-module': false,
    };
    return config;
  },
};

module.exports = nextConfig;
