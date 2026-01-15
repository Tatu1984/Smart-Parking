import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool, neonConfig } from '@neondatabase/serverless'

// Enable WebSocket for Neon in serverless environments
if (typeof globalThis.WebSocket !== 'undefined') {
  neonConfig.webSocketConstructor = globalThis.WebSocket
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL

  // Debug logging
  console.log('=== DATABASE CONNECTION DEBUG ===')
  console.log('DATABASE_URL exists:', !!connectionString)
  console.log('DATABASE_URL length:', connectionString?.length || 0)
  console.log('NODE_ENV:', process.env.NODE_ENV)
  console.log('VERCEL:', process.env.VERCEL)

  if (!connectionString) {
    console.error('DATABASE_URL environment variable is not set!')
    console.error('All env keys:', Object.keys(process.env).sort().join(', '))
    throw new Error('DATABASE_URL is required. Please set it in your environment variables.')
  }

  // Validate connection string format
  if (!connectionString.startsWith('postgres')) {
    console.error('DATABASE_URL does not look like a PostgreSQL connection string')
    console.error('First 20 chars:', connectionString.substring(0, 20))
    throw new Error('DATABASE_URL must be a valid PostgreSQL connection string')
  }

  console.log('Connecting to database with valid connection string...')

  try {
    const pool = new Pool({ connectionString })
    const adapter = new PrismaPg(pool)

    return new PrismaClient({
      adapter,
      log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    })
  } catch (error) {
    console.error('Failed to create database connection:', error)
    throw error
  }
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export default prisma
