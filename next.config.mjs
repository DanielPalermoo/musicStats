/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ['172.26.86.42', '172.26.86.42:3000', 'localhost', 'localhost:3000'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.ytimg.com',
      },
      {
        protocol: 'https',
        hostname: 'i.ytimg.com',
      },
      {
        protocol: 'https',
        hostname: '**.ggpht.com',
      },
      {
        protocol: 'https',
        hostname: '**.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: '**.scdn.co',
      },
      {
        protocol: 'https',
        hostname: '**.spotifycdn.com',
      },
      {
        protocol: 'https',
        hostname: '**.dzcdn.net',
      },
      {
        protocol: 'https',
        hostname: '**.sndcdn.com',
      },
      {
        protocol: 'https',
        hostname: '**.tidal.com',
      },
      {
        protocol: 'https',
        hostname: 'resources.tidal.com',
      },
    ],
  },
};

export default nextConfig;
