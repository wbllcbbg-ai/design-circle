import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  allowedDevOrigins: ["192.168.1.3", "192.168.*"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "**.supabase.co",
      },
      {
        protocol: "https",
        hostname: "placehold.co",
      },
    ],
    // 减少不必要的图片格式转换，保持兼容性
    formats: ["image/avif", "image/webp"],
  },
};

export default nextConfig;
