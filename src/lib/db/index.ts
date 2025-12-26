import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool, neonConfig } from '@neondatabase/serverless'
import ws from 'ws'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL

  // Check if running on Vercel/serverless (Neon database)
  const isServerless = connectionString?.includes('neon.tech') ||
                       connectionString?.includes('neon.') ||
                       process.env.VERCEL === '1'

  if (isServerless) {
    // Use Neon serverless adapter for Vercel
    neonConfig.webSocketConstructor = ws
    const pool = new Pool({ connectionString })
    const adapter = new PrismaPg(pool)
    return new PrismaClient({
      adapter,
      log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    })
  } else {
    // Use standard pg for local development
    const { Pool: PgPool } = require('pg')
    const pool = new PgPool({ connectionString })
    const adapter = new PrismaPg(pool)
    return new PrismaClient({
      adapter,
      log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    })
  }
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export default prisma
