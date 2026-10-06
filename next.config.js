/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**', // যেকোনো এক্সটার্নাল বা সুপাবেস স্টোরেজ ইমেজ এলাও করার জন্য
      },
    ],
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
