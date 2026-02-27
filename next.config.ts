import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin()

const nextConfig: NextConfig = {
  experimental: {
    serverBodySizeLimit: '20mb',
  },
}

export default withNextIntl(nextConfig)
