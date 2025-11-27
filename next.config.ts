
import type {NextConfig} from 'next';
const withNextIntl = require('next-intl/plugin')('./src/i18n.ts');

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'www.invokeia.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'www.brou.com.uy',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'www.bcu.gub.uy',
        port: '',
        pathname: '/**',
      }
    ],
  },
};

export default withNextIntl(nextConfig);

    

    