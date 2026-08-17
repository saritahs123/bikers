import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'bikers-fort-prod-media.s3.us-east-1.amazonaws.com',
      },
      {
        protocol: 'https',
        hostname: 's3.us-east-1.amazonaws.com',
      }
    ],
  },
};

export default nextConfig;
