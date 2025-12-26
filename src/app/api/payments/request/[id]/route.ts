import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'

// GET /api/payments/request/[id] - Get payment request details (public endpoint)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Find payment by ID or payment reference
    const payment = await prisma.payment.findFirst({
      where: {
        OR: [{ id }, { paymentRef: id }],
      },
      include: {
        payeeWallet: {
          select: {
            id: true,
            walletType: true,
            userId: true,
          },
        },
      },
    })

    if (!payment) {
      return NextResponse.json(
        { success: false, error: 'Payment not found' },
        { status: 404 }
      )
    }

    // Check if expired and update status
    if (payment.status === 'PENDING' && payment.expiresAt && new Date() > payment.expiresAt) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'EXPIRED' },
      })
      payment.status = 'EXPIRED'
    }

    return NextResponse.json({
      success: true,
      data: {
        id: payment.id,
        paymentRef: payment.paymentRef,
        amount: Number(payment.amount),
        description: payment.description,
        status: payment.status,
        expiresAt: payment.expiresAt?.toISOString(),
        payeeWallet: payment.payeeWallet,
        createdAt: payment.createdAt.toISOString(),
      },
    })
  } catch (error) {
    console.error('Error fetching payment:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch payment' },
      { status: 500 }
    )
  }
}

// DELETE /api/payments/request/[id] - Cancel payment request
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const payment = await prisma.payment.findFirst({
      where: {
        OR: [{ id }, { paymentRef: id }],
        status: 'PENDING',
      },
    })

    if (!payment) {
      return NextResponse.json(
        { success: false, error: 'Payment not found or already processed' },
        { status: 404 }
      )
    }

    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'CANCELLED' },
    })

    return NextResponse.json({
      success: true,
      message: 'Payment request cancelled',
    })
  } catch (error) {
    console.error('Error cancelling payment:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to cancel payment' },
      { status: 500 }
    )
  }
}
