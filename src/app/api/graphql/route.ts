import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'

/**
 * Simple GraphQL-like API endpoint
 * Supports basic queries for parking data
 */

type QueryResolver = (args: Record<string, unknown>) => Promise<unknown>

const resolvers: Record<string, QueryResolver> = {
  // Parking Lots
  parkingLots: async (args) => {
    const where: Record<string, unknown> = {}
    if (args.status) where.status = args.status
    if (args.city) where.city = args.city

    return prisma.parkingLot.findMany({
      where,
      include: {
        zones: {
          include: {
            slots: true
          }
        }
      }
    })
  },

  parkingLot: async (args) => {
    if (!args.id) throw new Error('id is required')

    return prisma.parkingLot.findUnique({
      where: { id: args.id as string },
      include: {
        zones: {
          include: {
            slots: true
          }
        },
        cameras: true,
        analytics: {
          take: 24,
          orderBy: { date: 'desc' }
        }
      }
    })
  },

  // Zones
  zones: async (args) => {
    const where: Record<string, unknown> = {}
    if (args.parkingLotId) where.parkingLotId = args.parkingLotId
    if (args.level !== undefined) where.level = args.level

    return prisma.zone.findMany({
      where,
      include: {
        slots: true,
        parkingLot: true
      }
    })
  },

  zone: async (args) => {
    if (!args.id) throw new Error('id is required')

    return prisma.zone.findUnique({
      where: { id: args.id as string },
      include: {
        slots: {
          include: {
            occupancies: {
              where: { endTime: null },
              take: 1
            }
          }
        },
        parkingLot: true
      }
    })
  },

  // Slots
  slots: async (args) => {
    const where: Record<string, unknown> = {}
    if (args.zoneId) where.zoneId = args.zoneId
    if (args.status) where.status = args.status
    if (args.type) where.slotType = args.type

    return prisma.slot.findMany({
      where,
      include: {
        zone: true,
        occupancies: {
          where: { endTime: null },
          take: 1
        }
      }
    })
  },

  availableSlots: async (args) => {
    if (!args.parkingLotId) throw new Error('parkingLotId is required')

    return prisma.slot.findMany({
      where: {
        zone: {
          parkingLotId: args.parkingLotId as string
        },
        status: 'AVAILABLE'
      },
      include: {
        zone: true
      }
    })
  },

  // Tokens
  tokens: async (args) => {
    const where: Record<string, unknown> = {}
    if (args.status) where.status = args.status
    if (args.licensePlate) where.licensePlate = args.licensePlate

    const take = Math.min((args.limit as number) || 100, 500)
    const skip = (args.offset as number) || 0

    return prisma.token.findMany({
      where,
      include: {
        allocatedSlot: {
          include: {
            zone: true
          }
        },
        transactions: true
      },
      take,
      skip,
      orderBy: { entryTime: 'desc' }
    })
  },

  token: async (args) => {
    if (!args.id && !args.tokenNumber) {
      throw new Error('id or tokenNumber is required')
    }

    const where: Record<string, unknown> = {}
    if (args.id) where.id = args.id
    if (args.tokenNumber) where.tokenNumber = args.tokenNumber

    return prisma.token.findFirst({
      where,
      include: {
        allocatedSlot: {
          include: {
            zone: {
              include: {
                parkingLot: true
              }
            }
          }
        },
        transactions: true
      }
    })
  },

  activeTokens: async (args) => {
    const where: Record<string, unknown> = { status: 'ACTIVE' }

    if (args.parkingLotId) {
      where.allocatedSlot = {
        zone: {
          parkingLotId: args.parkingLotId
        }
      }
    }

    return prisma.token.findMany({
      where,
      include: {
        allocatedSlot: {
          include: {
            zone: true
          }
        }
      },
      orderBy: { entryTime: 'desc' }
    })
  },

  // Payments
  payments: async (args) => {
    const where: Record<string, unknown> = {}
    if (args.status) where.status = args.status
    if (args.paymentType) where.paymentType = args.paymentType

    const take = Math.min((args.limit as number) || 100, 500)
    const skip = (args.offset as number) || 0

    return prisma.payment.findMany({
      where,
      include: {
        payerWallet: true,
        payeeWallet: true
      },
      take,
      skip,
      orderBy: { createdAt: 'desc' }
    })
  },

  // Analytics
  analytics: async (args) => {
    if (!args.parkingLotId) throw new Error('parkingLotId is required')

    const where: Record<string, unknown> = {
      parkingLotId: args.parkingLotId
    }

    if (args.startDate) {
      where.date = { gte: new Date(args.startDate as string) }
    }
    if (args.endDate) {
      where.date = {
        ...(where.date as Record<string, Date> || {}),
        lte: new Date(args.endDate as string)
      }
    }

    return prisma.parkingAnalytics.findMany({
      where,
      orderBy: { date: 'desc' },
      take: (args.limit as number) || 100
    })
  },

  // Dashboard summary
  dashboardSummary: async (args) => {
    const parkingLotId = args.parkingLotId as string | undefined

    const lotWhere = parkingLotId ? { id: parkingLotId } : {}
    const slotWhere = parkingLotId
      ? { zone: { parkingLotId } }
      : {}

    const [
      totalLots,
      totalSlots,
      availableSlots,
      activeTokens,
      todayRevenue
    ] = await Promise.all([
      prisma.parkingLot.count({ where: lotWhere }),
      prisma.slot.count({ where: slotWhere }),
      prisma.slot.count({ where: { ...slotWhere, status: 'AVAILABLE' } }),
      prisma.token.count({ where: { status: 'ACTIVE' } }),
      prisma.payment.aggregate({
        where: {
          status: 'COMPLETED',
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0))
          }
        },
        _sum: { amount: true }
      })
    ])

    return {
      totalLots,
      totalSlots,
      availableSlots,
      occupiedSlots: totalSlots - availableSlots,
      occupancyRate: totalSlots > 0 ? ((totalSlots - availableSlots) / totalSlots) : 0,
      activeTokens,
      todayRevenue: todayRevenue._sum.amount || 0
    }
  },

  // Users
  users: async (args) => {
    const take = Math.min((args.limit as number) || 50, 100)
    const skip = (args.offset as number) || 0

    return prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        updatedAt: true
      },
      take,
      skip,
      orderBy: { createdAt: 'desc' }
    })
  },

  me: async () => {
    // This would be handled by session
    return null
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { query, variables = {} } = body

    if (!query) {
      return NextResponse.json(
        { error: 'query is required' },
        { status: 400 }
      )
    }

    // Parse the simple query format: "queryName(arg1: value1, arg2: value2)"
    const match = query.match(/^(\w+)(?:\((.*)\))?$/)
    if (!match) {
      return NextResponse.json(
        { error: 'Invalid query format. Use: queryName or queryName(arg: value)' },
        { status: 400 }
      )
    }

    const [, queryName, argsString] = match
    const resolver = resolvers[queryName]

    if (!resolver) {
      return NextResponse.json(
        { error: `Unknown query: ${queryName}. Available: ${Object.keys(resolvers).join(', ')}` },
        { status: 400 }
      )
    }

    // Parse arguments
    const args: Record<string, unknown> = { ...variables }

    if (argsString) {
      const argPairs = argsString.split(',').map((s: string) => s.trim())
      for (const pair of argPairs) {
        const [key, value] = pair.split(':').map((s: string) => s.trim())
        if (key && value !== undefined) {
          // Try to parse as JSON, fallback to string
          try {
            args[key] = JSON.parse(value)
          } catch {
            // Remove quotes if present
            args[key] = value.replace(/^["']|["']$/g, '')
          }
        }
      }
    }

    const result = await resolver(args)

    return NextResponse.json({
      data: { [queryName]: result }
    })
  } catch (error) {
    console.error('GraphQL error:', error)
    return NextResponse.json(
      {
        errors: [{
          message: error instanceof Error ? error.message : 'Internal server error'
        }]
      },
      { status: 500 }
    )
  }
}

/**
 * GET endpoint for schema introspection
 */
export async function GET() {
  const schema = {
    queries: Object.keys(resolvers),
    description: 'Simple GraphQL-like API for Sparking parking management',
    examples: [
      { query: 'parkingLots', description: 'List all parking lots' },
      { query: 'parkingLot(id: "xxx")', description: 'Get parking lot by ID' },
      { query: 'zones(parkingLotId: "xxx")', description: 'List zones for a parking lot' },
      { query: 'availableSlots(parkingLotId: "xxx")', description: 'Get available slots' },
      { query: 'tokens(status: "ACTIVE", limit: 50)', description: 'List tokens with filters' },
      { query: 'dashboardSummary', description: 'Get dashboard statistics' },
      { query: 'analytics(parkingLotId: "xxx", startDate: "2024-01-01")', description: 'Get analytics data' }
    ]
  }

  return NextResponse.json(schema)
}
