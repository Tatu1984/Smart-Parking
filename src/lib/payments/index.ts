/**
 * Payment Gateway Integration
 * Supports Razorpay, Stripe, and Cash payments
 */

export * from './razorpay'

export type PaymentMethod = 'razorpay' | 'stripe' | 'cash' | 'wallet' | 'upi'
export type PaymentStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'refunded'

export interface PaymentRequest {
  amount: number
  currency: string
  method: PaymentMethod
  tokenId?: string
  sessionId?: string
  customerId?: string
  description?: string
  metadata?: Record<string, unknown>
}

export interface PaymentResult {
  success: boolean
  paymentId?: string
  orderId?: string
  status: PaymentStatus
  transactionId?: string
  error?: string
  redirectUrl?: string
}

/**
 * Process a payment
 */
export async function processPayment(request: PaymentRequest): Promise<PaymentResult> {
  switch (request.method) {
    case 'razorpay':
      return processRazorpayPayment(request)
    case 'stripe':
      return processStripePayment(request)
    case 'cash':
      return processCashPayment(request)
    case 'wallet':
      return processWalletPayment(request)
    case 'upi':
      return processUPIPayment(request)
    default:
      return {
        success: false,
        status: 'failed',
        error: `Unsupported payment method: ${request.method}`
      }
  }
}

async function processRazorpayPayment(request: PaymentRequest): Promise<PaymentResult> {
  try {
    const { createOrder } = await import('./razorpay')

    const order = await createOrder({
      amount: request.amount,
      currency: request.currency,
      receipt: request.tokenId || request.sessionId || `payment-${Date.now()}`
    })

    return {
      success: true,
      orderId: order.id,
      status: 'pending',
      redirectUrl: `/pay?orderId=${order.id}`
    }
  } catch (error) {
    return {
      success: false,
      status: 'failed',
      error: error instanceof Error ? error.message : 'Payment failed'
    }
  }
}

async function processStripePayment(request: PaymentRequest): Promise<PaymentResult> {
  // Stripe integration placeholder
  return {
    success: false,
    status: 'failed',
    error: 'Stripe integration not yet implemented'
  }
}

async function processCashPayment(request: PaymentRequest): Promise<PaymentResult> {
  // Cash payments are handled at the kiosk
  return {
    success: true,
    status: 'pending',
    transactionId: `cash-${Date.now()}`
  }
}

async function processWalletPayment(request: PaymentRequest): Promise<PaymentResult> {
  try {
    // Import prisma dynamically
    const { prisma } = await import('@/lib/db')

    if (!request.customerId) {
      return {
        success: false,
        status: 'failed',
        error: 'Customer ID required for wallet payment'
      }
    }

    // Get wallet balance
    const wallet = await prisma.wallet.findUnique({
      where: { userId: request.customerId }
    })

    if (!wallet || wallet.balance < request.amount) {
      return {
        success: false,
        status: 'failed',
        error: 'Insufficient wallet balance'
      }
    }

    // Deduct from wallet
    await prisma.$transaction([
      prisma.wallet.update({
        where: { id: wallet.id },
        data: {
          balance: { decrement: request.amount }
        }
      }),
      prisma.walletTransaction.create({
        data: {
          senderWalletId: wallet.id,
          txnType: 'PAYMENT',
          amount: request.amount,
          description: request.description || 'Parking payment',
          referenceId: request.tokenId || request.sessionId || `pay-${Date.now()}`
        }
      })
    ])

    return {
      success: true,
      status: 'completed',
      transactionId: `wallet-${Date.now()}`
    }
  } catch (error) {
    return {
      success: false,
      status: 'failed',
      error: error instanceof Error ? error.message : 'Wallet payment failed'
    }
  }
}

async function processUPIPayment(request: PaymentRequest): Promise<PaymentResult> {
  try {
    const { createPaymentLink } = await import('./razorpay')

    const link = await createPaymentLink({
      amount: request.amount,
      currency: request.currency,
      description: request.description || 'Parking Payment',
      reference_id: request.tokenId || request.sessionId
    })

    return {
      success: true,
      status: 'pending',
      paymentId: link.id,
      redirectUrl: link.short_url
    }
  } catch (error) {
    return {
      success: false,
      status: 'failed',
      error: error instanceof Error ? error.message : 'UPI payment failed'
    }
  }
}

/**
 * Calculate parking fee
 */
export function calculateParkingFee(params: {
  entryTime: Date
  exitTime?: Date
  hourlyRate: number
  minimumCharge?: number
  freeMinutes?: number
  maxDailyCharge?: number
  currency?: string
}): {
  duration: number // in minutes
  hours: number
  fee: number
  currency: string
} {
  const exitTime = params.exitTime || new Date()
  const durationMs = exitTime.getTime() - params.entryTime.getTime()
  const durationMinutes = Math.max(0, Math.ceil(durationMs / 60000))

  // Apply free minutes
  const billableMinutes = Math.max(0, durationMinutes - (params.freeMinutes || 0))
  const hours = Math.ceil(billableMinutes / 60)

  // Calculate base fee
  let fee = hours * params.hourlyRate

  // Apply minimum charge
  if (params.minimumCharge && fee < params.minimumCharge) {
    fee = params.minimumCharge
  }

  // Apply daily maximum
  if (params.maxDailyCharge && fee > params.maxDailyCharge) {
    fee = params.maxDailyCharge
  }

  return {
    duration: durationMinutes,
    hours,
    fee,
    currency: params.currency || 'INR'
  }
}
