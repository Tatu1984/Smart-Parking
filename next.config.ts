import type { NextConfig } from 'next'

// Get allowed origins from environment or use defaults
const getAllowedOrigins = () => {
  const origins = process.env.ALLOWED_ORIGINS
  if (origins) {
    return origins.split(',').map(o => o.trim())
  }
  // Default origins for development
  if (process.env.NODE_ENV !== 'production') {
    return ['http://localhost:3000', 'http://127.0.0.1:3000']
  }
  // In production, require explicit configuration
  return []
}

const nextConfig: NextConfig = {
  reactCompiler: true,
  output: 'standalone',
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  async headers() {
    const allowedOrigins = getAllowedOrigins()
    // For CORS with credentials, we need to return the specific origin, not wildcard
    // This is handled dynamically in middleware for production
    // For static config, we set reasonable defaults
    const corsOrigin = process.env.NODE_ENV === 'production'
      ? (process.env.NEXT_PUBLIC_APP_URL || 'https://sparking.io')
      : 'http://localhost:3000'

    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Allow-Origin', value: corsOrigin },
          { key: 'Access-Control-Allow-Methods', value: 'GET,DELETE,PATCH,POST,PUT,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, X-API-Key' },
        ],
      },
    ]
  },
}

export default nextConfig
