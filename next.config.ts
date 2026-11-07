/** @type {import("next").NextConfig} */
const nextConfig = {
  webpack: (config: any, { isServer }: any) => {
    return config;
  },
  turbopack: {},
};

export default nextConfig;
