/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['localhost', 'underfields.com'], // 必要に応じて本番ドメインを追加
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...(config.resolve.alias || {}), // 既存のエイリアスを安全に拡張
    };
    return config;
  },
};

module.exports = nextConfig;
