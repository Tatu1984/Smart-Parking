import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { getCurrentUser } from '@/lib/auth/session'
import { nanoid } from 'nanoid'
import QRCode from 'qrcode'

// GET /api/payments/request - Get payment requests
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const walletId = searchParams.get('walletId')
    const type = searchParams.get('type') // 'sent' or 'received'
    const status = searchParams.get('status')

    // Get user's wallets
    const wallets = await prisma.wallet.findMany({
      where: { userId: user.id },
      select: { id: true },
    })

    const walletIds = wallets.map((w) => w.id)

    let where: any = {}

    if (walletId && walletIds.includes(walletId)) {
      if (type === 'sent') {
        where.payeeWalletId = walletId
      } else if (type === 'received') {
        where.payerWalletId = walletId
      } else {
        where.OR = [{ payeeWalletId: walletId }, { payerWalletId: walletId }]
      }
    } else {
      where.OR = [
        { payeeWalletId: { in: walletIds } },
        { payerWalletId: { in: walletIds } },
      ]
    }

    if (status) {
      where.status = status
    }

    const payments = await prisma.payment.findMany({
      where,
      include: {
        payerWallet: {
          select: { id: true, walletType: true, userId: true },
        },
        payeeWallet: {
          select: { id: true, walletType: true, userId: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    const formattedPayments = payments.map((p) => ({
      ...p,
      amount: Number(p.amount),
      isOutgoing: walletIds.includes(p.payeeWalletId),
    }))

    return NextResponse.json({ success: true, data: formattedPayments })
  } catch (error) {
    console.error('Error fetching payment requests:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch payment requests' },
      { status: 500 }
    )
  }
}

// POST /api/payments/request - Create a payment request (like PayPal's Request Money)
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      walletId, // Requestor's wallet (payee)
      payerEmail, // Optional - specific payer
      payerWalletId, // Optional - specific payer wallet
      amount,
      description,
      paymentType = 'REQUEST', // REQUEST, INVOICE, QR_CODE
      expiresInHours = 168, // 7 days default
    } = body

    // Validate amount
    if (!amount || amount <= 0) {
      return NextResponse.json({ success: false, error: 'Invalid amount' }, { status: 400 })
    }

    // Verify wallet ownership
    const payeeWallet = await prisma.wallet.findFirst({
      where: { id: walletId, userId: user.id },
      include: { sandboxConfig: true },
    })

    if (!payeeWallet) {
      return NextResponse.json({ success: false, error: 'Wallet not found' }, { status: 404 })
    }

    // Find payer wallet if specified
    let payerWallet = null
    if (payerWalletId) {
      payerWallet = await prisma.wallet.findFirst({
        where: { id: payerWalletId },
      })
    } else if (payerEmail) {
      const payerUser = await prisma.user.findUnique({
        where: { email: payerEmail },
      })
      if (payerUser) {
        payerWallet = await prisma.wallet.findFirst({
          where: { userId: payerUser.id, walletType: 'PERSONAL' },
        })
      }
    }

    const paymentRef = `PAY_${nanoid(12)}`
    const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000)

    // Generate QR code for payment
    const paymentUrl = `${process.env.NEXT_PUBLIC_APP_URL}/pay/${paymentRef}`
    let qrCode = null
    if (paymentType === 'QR_CODE' || !payerWallet) {
      try {
        qrCode = await QRCode.toDataURL(paymentUrl, {
          width: 300,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF',
          },
        })
      } catch (err) {
        console.error('QR generation failed:', err)
      }
    }

    const payment = await prisma.payment.create({
      data: {
        payerWalletId: payerWallet?.id || null,
        payeeWalletId: walletId,
        amount: BigInt(amount),
        paymentType,
        status: 'PENDING',
        paymentRef,
        description,
        qrCode,
        expiresAt,
        isSandbox: payeeWallet.sandboxConfig !== null,
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        ...payment,
        amount: Number(payment.amount),
        paymentUrl,
      },
      message: payerWallet
        ? 'Payment request sent to recipient'
        : 'Payment link created. Share it with the payer.',
    })
  } catch (error) {
    console.error('Error creating payment request:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create payment request' },
      { status: 500 }
    )
  }
}
