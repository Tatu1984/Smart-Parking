import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { createOrder, getPublicKey } from '@/lib/payments/razorpay'
import { calculateParkingFee } from '@/lib/payments'
import { getSession } from '@/lib/auth/session'

// POST /api/payments - Create a payment order
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { tokenId, amount, currency = 'INR' } = body

    // Validate token and calculate fee if not provided
    let paymentAmount = amount
    let token = null
    let slotInfo = null

    if (tokenId) {
      token = await prisma.token.findUnique({
        where: { id: tokenId },
        include: {
          allocatedSlot: {
            include: {
              zone: true
            }
          },
          parkingLot: true
        }
      })

      if (!token) {
        return NextResponse.json({ error: 'Token not found' }, { status: 404 })
      }

      if (token.status === 'COMPLETED' || token.status === 'CANCELLED') {
        return NextResponse.json({ error: 'Token already completed or cancelled' }, { status: 400 })
      }

      slotInfo = token.allocatedSlot

      // Calculate fee if not provided
      if (!paymentAmount) {
        // Get pricing from zone or use default
        const pricingRule = await prisma.pricingRule.findFirst({
          where: {
            parkingLotId: token.parkingLotId,
            isActive: true
          },
          orderBy: { priority: 'desc' }
        })

        const hourlyRate = pricingRule?.hourlyRate || 5000 // 50 INR in paisa
        const feeDetails = calculateParkingFee({
          entryTime: token.entryTime,
          hourlyRate: hourlyRate / 100, // Convert paisa to rupees
          freeMinutes: 15,
          minimumCharge: hourlyRate / 100
        })
        paymentAmount = feeDetails.fee
      }
    }

    if (!paymentAmount || paymentAmount <= 0) {
      return NextResponse.json({ error: 'Invalid payment amount' }, { status: 400 })
    }

    // Create Razorpay order
    const order = await createOrder({
      amount: paymentAmount,
      currency,
      receipt: tokenId || `payment-${Date.now()}`,
      notes: {
        tokenId: tokenId || '',
        parkingLotId: token?.parkingLotId || ''
      }
    })

    // Store transaction record
    const transaction = await prisma.transaction.create({
      data: {
        parkingLotId: token?.parkingLotId || '',
        tokenId: tokenId,
        entryTime: token?.entryTime || new Date(),
        grossAmount: Math.round(paymentAmount * 100), // Store in paisa
        netAmount: Math.round(paymentAmount * 100),
        currency,
        paymentStatus: 'PENDING',
        paymentRef: order.id
      }
    })

    return NextResponse.json({
      success: true,
      orderId: order.id,
      transactionId: transaction.id,
      amount: paymentAmount,
      currency,
      key: getPublicKey(),
      tokenDetails: token ? {
        tokenNumber: token.tokenNumber,
        licensePlate: token.licensePlate,
        entryTime: token.entryTime,
        slotNumber: slotInfo?.slotNumber,
        zoneName: slotInfo?.zone?.name
      } : null
    })
  } catch (error) {
    console.error('Payment creation error:', error)
    return NextResponse.json(
      { error: 'Failed to create payment order' },
      { status: 500 }
    )
  }
}

// GET /api/payments - Get payment history (transactions)
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    const status = searchParams.get('status')
    const parkingLotId = searchParams.get('parkingLotId')

    const user = await prisma.user.findUnique({
      where: { id: session.userId }
    })

    const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN'

    const transactions = await prisma.transaction.findMany({
      where: {
        ...(status && { paymentStatus: status.toUpperCase() as any }),
        ...(parkingLotId && { parkingLotId }),
      },
      include: {
        token: {
          select: {
            tokenNumber: true,
            licensePlate: true,
            entryTime: true,
            exitTime: true
          }
        },
        parkingLot: {
          select: {
            name: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset
    })

    const total = await prisma.transaction.count({
      where: {
        ...(status && { paymentStatus: status.toUpperCase() as any }),
        ...(parkingLotId && { parkingLotId }),
      }
    })

    return NextResponse.json({
      transactions,
      total,
      hasMore: offset + transactions.length < total
    })
  } catch (error) {
    console.error('Transactions GET error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch transactions' },
      { status: 500 }
    )
  }
}
