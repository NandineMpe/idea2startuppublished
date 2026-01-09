/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
    domains: ['images.unsplash.com', 'img.clerk.com', 'img.clerk.af-south-1'],
  },
  // Ensure NEXT_PUBLIC_ variables from .env are available
}

export default nextConfig