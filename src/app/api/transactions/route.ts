import { NextRequest } from 'next/server'
import prisma from '@/lib/db'
import { paginatedResponse, handleApiError, parseQueryParams } from '@/lib/utils/api'

// GET /api/transactions - List all transactions
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const { page, limit, search, sortBy, sortOrder } = parseQueryParams(searchParams)
    const parkingLotId = searchParams.get('parkingLotId')
    const paymentStatus = searchParams.get('paymentStatus')
    const paymentMethod = searchParams.get('paymentMethod')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')

    const where = {
      ...(parkingLotId && { parkingLotId }),
      ...(paymentStatus && { paymentStatus: paymentStatus as any }),
      ...(paymentMethod && { paymentMethod: paymentMethod as any }),
      ...(dateFrom && {
        createdAt: {
          gte: new Date(dateFrom),
          ...(dateTo && { lte: new Date(dateTo) }),
        },
      }),
      ...(search && {
        OR: [
          { receiptNumber: { contains: search, mode: 'insensitive' as const } },
          { token: { tokenNumber: { contains: search, mode: 'insensitive' as const } } },
          { token: { licensePlate: { contains: search, mode: 'insensitive' as const } } },
        ],
      }),
    }

    const [transactions, total, aggregates] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: {
          parkingLot: {
            select: { id: true, name: true },
          },
          token: {
            select: {
              id: true,
              tokenNumber: true,
              licensePlate: true,
              vehicleType: true,
              allocatedSlot: {
                select: {
                  slotNumber: true,
                  zone: {
                    select: { name: true, code: true },
                  },
                },
              },
            },
          },
        },
        orderBy: sortBy ? { [sortBy]: sortOrder } : { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.transaction.count({ where }),
      prisma.transaction.aggregate({
        where,
        _sum: {
          netAmount: true,
          grossAmount: true,
          tax: true,
          discount: true,
        },
        _avg: {
          netAmount: true,
          duration: true,
        },
      }),
    ])

    return paginatedResponse(
      transactions.map((t: typeof transactions[number]) => ({
        ...t,
        netAmountRupees: t.netAmount / 100,
        grossAmountRupees: t.grossAmount / 100,
        taxRupees: t.tax / 100,
      })),
      page,
      limit,
      total
    )
  } catch (error) {
    return handleApiError(error)
  }
}
