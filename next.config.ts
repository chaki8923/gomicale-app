import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'
import withPWAInit from '@ducanh2912/next-pwa'

const withNextIntl = createNextIntlPlugin()

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
    ],
  },
}

const withPWA = withPWAInit({
  dest: 'public',
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === 'development',
  workboxOptions: { disableDevLogs: true },
})

export default withPWA(withNextIntl(nextConfig))
