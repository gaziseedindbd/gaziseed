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
  experimental: { cpus: 1 },
  webpack: (config) => {
    config.parallelism = 1;
    return config;
  },
};

module.exports = nextConfig;
