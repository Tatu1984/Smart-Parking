import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { createOrder, getPublicKey } from '@/lib/payments/razorpay'
import { calculateParkingFee } from '@/lib/payments'
import { getSession } from '@/lib/auth/session'

// POST /api/payments - Create a payment order
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { tokenId, amount, currency = 'INR', method = 'razorpay' } = body

    // Validate token and calculate fee if not provided
    let paymentAmount = amount
    let token = null

    if (tokenId) {
      token = await prisma.token.findUnique({
        where: { id: tokenId },
        include: {
          slot: {
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

      if (token.status === 'PAID' || token.status === 'EXITED') {
        return NextResponse.json({ error: 'Token already paid or exited' }, { status: 400 })
      }

      // Calculate fee if not provided
      if (!paymentAmount) {
        const hourlyRate = token.slot?.zone?.hourlyRate || token.parkingLot?.defaultHourlyRate || 50
        const feeDetails = calculateParkingFee({
          entryTime: token.entryTime,
          hourlyRate,
          freeMinutes: 15, // 15 minutes free
          minimumCharge: hourlyRate
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

    // Store payment record
    const payment = await prisma.payment.create({
      data: {
        tokenId: tokenId || null,
        amount: paymentAmount,
        currency,
        method: method.toUpperCase(),
        status: 'PENDING',
        orderId: order.id,
        metadata: {
          razorpayOrderId: order.id
        }
      }
    })

    return NextResponse.json({
      success: true,
      orderId: order.id,
      paymentId: payment.id,
      amount: paymentAmount,
      currency,
      key: getPublicKey(),
      tokenDetails: token ? {
        tokenNumber: token.tokenNumber,
        licensePlate: token.licensePlate,
        entryTime: token.entryTime,
        slotNumber: token.slot?.slotNumber,
        zoneName: token.slot?.zone?.name
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

// GET /api/payments - Get payment history
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

    const user = await prisma.user.findUnique({
      where: { id: session.userId }
    })

    const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN'

    const payments = await prisma.payment.findMany({
      where: {
        ...(status && { status: status.toUpperCase() }),
        // Non-admins can only see their own payments
        ...(!isAdmin && {
          token: {
            licensePlate: user?.licensePlate || undefined
          }
        })
      },
      include: {
        token: {
          select: {
            tokenNumber: true,
            licensePlate: true,
            entryTime: true,
            exitTime: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset
    })

    const total = await prisma.payment.count({
      where: {
        ...(status && { status: status.toUpperCase() })
      }
    })

    return NextResponse.json({
      payments,
      total,
      hasMore: offset + payments.length < total
    })
  } catch (error) {
    console.error('Payments GET error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch payments' },
      { status: 500 }
    )
  }
}
