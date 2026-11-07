/** @type {import("next").NextConfig} */
const nextConfig = {
  webpack: (config: any, { isServer }: any) => {
    return config;
  },
};

export default nextConfig;
