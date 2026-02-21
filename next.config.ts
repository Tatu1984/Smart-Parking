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
      // Azure Blob Storage
      { protocol: 'https', hostname: '*.blob.core.windows.net' },
      // AWS S3
      { protocol: 'https', hostname: '*.s3.amazonaws.com' },
      { protocol: 'https', hostname: '*.s3.*.amazonaws.com' },
      // Cloudinary
      { protocol: 'https', hostname: 'res.cloudinary.com' },
      // Google (user avatars)
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      // GitHub (avatars)
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
      // Gravatar
      { protocol: 'https', hostname: '*.gravatar.com' },
    ],
  },
  async headers() {
    const corsOrigin = process.env.NODE_ENV === 'production'
      ? (process.env.NEXT_PUBLIC_APP_URL || 'https://sparking.io')
      : 'http://localhost:3000'

    return [
      {
        // Security headers for all routes
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
        ],
      },
      {
        // Mobile API: allow any origin (Bearer token auth, no cookies)
        source: '/api/mobile/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,DELETE,PATCH,POST,PUT,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
        ],
      },
      {
        // Web API: specific origin with credentials
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
