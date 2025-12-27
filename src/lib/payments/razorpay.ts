/**
 * Razorpay Payment Gateway Integration
 */

import crypto from 'crypto'

export interface RazorpayOrder {
  id: string
  entity: string
  amount: number
  amount_paid: number
  amount_due: number
  currency: string
  receipt: string
  status: string
  created_at: number
}

export interface RazorpayPayment {
  id: string
  entity: string
  amount: number
  currency: string
  status: string
  order_id: string
  method: string
  description?: string
  email?: string
  contact?: string
  created_at: number
}

export interface CreateOrderParams {
  amount: number
  currency?: string
  receipt: string
  notes?: Record<string, string>
}

export interface VerifyPaymentParams {
  razorpay_order_id: string
  razorpay_payment_id: string
  razorpay_signature: string
}

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || ''
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || ''
const RAZORPAY_API_URL = 'https://api.razorpay.com/v1'

/**
 * Create a new Razorpay order
 */
export async function createOrder(params: CreateOrderParams): Promise<RazorpayOrder> {
  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    throw new Error('Razorpay credentials not configured')
  }

  const response = await fetch(`${RAZORPAY_API_URL}/orders`, {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64'),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      amount: Math.round(params.amount * 100), // Convert to paise
      currency: params.currency || 'INR',
      receipt: params.receipt,
      notes: params.notes || {}
    })
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Razorpay order creation failed: ${error}`)
  }

  return response.json()
}

/**
 * Verify Razorpay payment signature
 */
export function verifyPaymentSignature(params: VerifyPaymentParams): boolean {
  if (!RAZORPAY_KEY_SECRET) {
    throw new Error('Razorpay secret not configured')
  }

  const expectedSignature = crypto
    .createHmac('sha256', RAZORPAY_KEY_SECRET)
    .update(`${params.razorpay_order_id}|${params.razorpay_payment_id}`)
    .digest('hex')

  return crypto.timingSafeEqual(
    Buffer.from(expectedSignature),
    Buffer.from(params.razorpay_signature)
  )
}

/**
 * Fetch payment details from Razorpay
 */
export async function getPayment(paymentId: string): Promise<RazorpayPayment> {
  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    throw new Error('Razorpay credentials not configured')
  }

  const response = await fetch(`${RAZORPAY_API_URL}/payments/${paymentId}`, {
    headers: {
      'Authorization': 'Basic ' + Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64')
    }
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Razorpay payment fetch failed: ${error}`)
  }

  return response.json()
}

/**
 * Capture a payment (for manual capture mode)
 */
export async function capturePayment(
  paymentId: string,
  amount: number,
  currency: string = 'INR'
): Promise<RazorpayPayment> {
  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    throw new Error('Razorpay credentials not configured')
  }

  const response = await fetch(`${RAZORPAY_API_URL}/payments/${paymentId}/capture`, {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64'),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      amount: Math.round(amount * 100),
      currency
    })
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Razorpay payment capture failed: ${error}`)
  }

  return response.json()
}

/**
 * Refund a payment
 */
export async function refundPayment(
  paymentId: string,
  amount?: number,
  notes?: Record<string, string>
): Promise<{ id: string; amount: number; status: string }> {
  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    throw new Error('Razorpay credentials not configured')
  }

  const body: Record<string, unknown> = {}
  if (amount) {
    body.amount = Math.round(amount * 100)
  }
  if (notes) {
    body.notes = notes
  }

  const response = await fetch(`${RAZORPAY_API_URL}/payments/${paymentId}/refund`, {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64'),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Razorpay refund failed: ${error}`)
  }

  return response.json()
}

/**
 * Create a payment link (for kiosk/QR payments)
 */
export async function createPaymentLink(params: {
  amount: number
  currency?: string
  description: string
  customer?: {
    name?: string
    email?: string
    contact?: string
  }
  expireBy?: number
  reference_id?: string
  callback_url?: string
  callback_method?: string
}): Promise<{
  id: string
  short_url: string
  status: string
  created_at: number
}> {
  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    throw new Error('Razorpay credentials not configured')
  }

  const response = await fetch(`${RAZORPAY_API_URL}/payment_links`, {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64'),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      amount: Math.round(params.amount * 100),
      currency: params.currency || 'INR',
      description: params.description,
      customer: params.customer,
      expire_by: params.expireBy,
      reference_id: params.reference_id,
      callback_url: params.callback_url,
      callback_method: params.callback_method || 'get'
    })
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Razorpay payment link creation failed: ${error}`)
  }

  return response.json()
}

/**
 * Create a QR code for UPI payments
 */
export async function createQRCode(params: {
  type: 'upi_qr'
  name: string
  usage: 'single_use' | 'multiple_use'
  fixed_amount: boolean
  payment_amount?: number
  description?: string
  customer_id?: string
  close_by?: number
}): Promise<{
  id: string
  image_url: string
  status: string
  created_at: number
}> {
  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    throw new Error('Razorpay credentials not configured')
  }

  const response = await fetch(`${RAZORPAY_API_URL}/payments/qr_codes`, {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64'),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      type: params.type,
      name: params.name,
      usage: params.usage,
      fixed_amount: params.fixed_amount,
      payment_amount: params.payment_amount ? Math.round(params.payment_amount * 100) : undefined,
      description: params.description,
      customer_id: params.customer_id,
      close_by: params.close_by
    })
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Razorpay QR code creation failed: ${error}`)
  }

  return response.json()
}

/**
 * Get Razorpay public key for frontend
 */
export function getPublicKey(): string {
  return RAZORPAY_KEY_ID
}
