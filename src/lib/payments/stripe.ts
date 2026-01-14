/**
 * Stripe Payment Gateway Integration
 */

import Stripe from 'stripe'

const stripeSecretKey = process.env.STRIPE_SECRET_KEY
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET

let stripeClient: Stripe | null = null

function getStripeClient(): Stripe {
  if (!stripeSecretKey) {
    throw new Error('STRIPE_SECRET_KEY is not configured')
  }

  if (!stripeClient) {
    stripeClient = new Stripe(stripeSecretKey, {
      apiVersion: '2025-12-15.clover',
      typescript: true
    })
  }

  return stripeClient
}

export function isStripeConfigured(): boolean {
  return !!stripeSecretKey
}

// ============================================
// PAYMENT INTENTS
// ============================================

export interface CreatePaymentIntentParams {
  amount: number // in smallest currency unit (e.g., paisa for INR)
  currency: string
  customerId?: string
  description?: string
  metadata?: Record<string, string>
  receiptEmail?: string
}

export interface PaymentIntentResult {
  id: string
  clientSecret: string
  status: string
  amount: number
  currency: string
}

export async function createPaymentIntent(
  params: CreatePaymentIntentParams
): Promise<PaymentIntentResult> {
  const stripe = getStripeClient()

  const paymentIntent = await stripe.paymentIntents.create({
    amount: params.amount,
    currency: params.currency.toLowerCase(),
    customer: params.customerId,
    description: params.description,
    metadata: params.metadata || {},
    receipt_email: params.receiptEmail,
    automatic_payment_methods: {
      enabled: true
    }
  })

  return {
    id: paymentIntent.id,
    clientSecret: paymentIntent.client_secret || '',
    status: paymentIntent.status,
    amount: paymentIntent.amount,
    currency: paymentIntent.currency
  }
}

export async function retrievePaymentIntent(paymentIntentId: string): Promise<PaymentIntentResult> {
  const stripe = getStripeClient()

  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)

  return {
    id: paymentIntent.id,
    clientSecret: paymentIntent.client_secret || '',
    status: paymentIntent.status,
    amount: paymentIntent.amount,
    currency: paymentIntent.currency
  }
}

export async function capturePaymentIntent(paymentIntentId: string): Promise<PaymentIntentResult> {
  const stripe = getStripeClient()

  const paymentIntent = await stripe.paymentIntents.capture(paymentIntentId)

  return {
    id: paymentIntent.id,
    clientSecret: paymentIntent.client_secret || '',
    status: paymentIntent.status,
    amount: paymentIntent.amount,
    currency: paymentIntent.currency
  }
}

export async function cancelPaymentIntent(paymentIntentId: string): Promise<PaymentIntentResult> {
  const stripe = getStripeClient()

  const paymentIntent = await stripe.paymentIntents.cancel(paymentIntentId)

  return {
    id: paymentIntent.id,
    clientSecret: paymentIntent.client_secret || '',
    status: paymentIntent.status,
    amount: paymentIntent.amount,
    currency: paymentIntent.currency
  }
}

// ============================================
// CUSTOMERS
// ============================================

export interface CreateCustomerParams {
  email?: string
  name?: string
  phone?: string
  metadata?: Record<string, string>
}

export async function createCustomer(params: CreateCustomerParams): Promise<string> {
  const stripe = getStripeClient()

  const customer = await stripe.customers.create({
    email: params.email,
    name: params.name,
    phone: params.phone,
    metadata: params.metadata || {}
  })

  return customer.id
}

export async function getCustomer(customerId: string): Promise<Stripe.Customer | null> {
  const stripe = getStripeClient()

  try {
    const customer = await stripe.customers.retrieve(customerId)
    if (customer.deleted) return null
    return customer as Stripe.Customer
  } catch {
    return null
  }
}

// ============================================
// REFUNDS
// ============================================

export interface RefundParams {
  paymentIntentId: string
  amount?: number // partial refund amount
  reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer'
}

export interface RefundResult {
  id: string
  amount: number
  status: string
  paymentIntentId: string
}

export async function createRefund(params: RefundParams): Promise<RefundResult> {
  const stripe = getStripeClient()

  const refund = await stripe.refunds.create({
    payment_intent: params.paymentIntentId,
    amount: params.amount,
    reason: params.reason
  })

  return {
    id: refund.id,
    amount: refund.amount,
    status: refund.status || 'pending',
    paymentIntentId: params.paymentIntentId
  }
}

// ============================================
// CHECKOUT SESSIONS
// ============================================

export interface CreateCheckoutParams {
  amount: number
  currency: string
  successUrl: string
  cancelUrl: string
  customerEmail?: string
  metadata?: Record<string, string>
  description?: string
}

export interface CheckoutSessionResult {
  id: string
  url: string
  status: string
}

export async function createCheckoutSession(
  params: CreateCheckoutParams
): Promise<CheckoutSessionResult> {
  const stripe = getStripeClient()

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: params.currency.toLowerCase(),
          product_data: {
            name: params.description || 'Parking Payment'
          },
          unit_amount: params.amount
        },
        quantity: 1
      }
    ],
    mode: 'payment',
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    customer_email: params.customerEmail,
    metadata: params.metadata || {}
  })

  return {
    id: session.id,
    url: session.url || '',
    status: session.status || 'open'
  }
}

export async function retrieveCheckoutSession(sessionId: string): Promise<CheckoutSessionResult> {
  const stripe = getStripeClient()

  const session = await stripe.checkout.sessions.retrieve(sessionId)

  return {
    id: session.id,
    url: session.url || '',
    status: session.status || 'expired'
  }
}

// ============================================
// WEBHOOKS
// ============================================

export function constructWebhookEvent(
  payload: string | Buffer,
  signature: string
): Stripe.Event {
  if (!stripeWebhookSecret) {
    throw new Error('STRIPE_WEBHOOK_SECRET is not configured')
  }

  const stripe = getStripeClient()
  return stripe.webhooks.constructEvent(payload, signature, stripeWebhookSecret)
}

export interface WebhookEventData {
  type: string
  paymentIntentId?: string
  checkoutSessionId?: string
  amount?: number
  status?: string
  metadata?: Record<string, string>
}

export function parseWebhookEvent(event: Stripe.Event): WebhookEventData {
  const data: WebhookEventData = {
    type: event.type
  }

  switch (event.type) {
    case 'payment_intent.succeeded':
    case 'payment_intent.payment_failed':
    case 'payment_intent.canceled': {
      const paymentIntent = event.data.object as Stripe.PaymentIntent
      data.paymentIntentId = paymentIntent.id
      data.amount = paymentIntent.amount
      data.status = paymentIntent.status
      data.metadata = paymentIntent.metadata as Record<string, string>
      break
    }

    case 'checkout.session.completed':
    case 'checkout.session.expired': {
      const session = event.data.object as Stripe.Checkout.Session
      data.checkoutSessionId = session.id
      data.paymentIntentId = session.payment_intent as string
      data.amount = session.amount_total || undefined
      data.status = session.status || undefined
      data.metadata = session.metadata as Record<string, string>
      break
    }

    case 'charge.refunded': {
      const charge = event.data.object as Stripe.Charge
      data.paymentIntentId = charge.payment_intent as string
      data.amount = charge.amount_refunded
      data.status = 'refunded'
      break
    }
  }

  return data
}

// ============================================
// PAYMENT METHODS
// ============================================

export async function listPaymentMethods(customerId: string): Promise<Stripe.PaymentMethod[]> {
  const stripe = getStripeClient()

  const paymentMethods = await stripe.paymentMethods.list({
    customer: customerId,
    type: 'card'
  })

  return paymentMethods.data
}

export async function attachPaymentMethod(
  paymentMethodId: string,
  customerId: string
): Promise<Stripe.PaymentMethod> {
  const stripe = getStripeClient()

  return stripe.paymentMethods.attach(paymentMethodId, {
    customer: customerId
  })
}

export async function detachPaymentMethod(paymentMethodId: string): Promise<Stripe.PaymentMethod> {
  const stripe = getStripeClient()
  return stripe.paymentMethods.detach(paymentMethodId)
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

export function getPublishableKey(): string {
  return process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ''
}

export function formatAmountForStripe(amount: number, currency: string): number {
  // Stripe expects amounts in smallest currency unit
  const zeroDecimalCurrencies = ['JPY', 'KRW', 'VND']
  if (zeroDecimalCurrencies.includes(currency.toUpperCase())) {
    return Math.round(amount)
  }
  // For INR, amount is already in paisa
  return Math.round(amount)
}

export function formatAmountFromStripe(amount: number, currency: string): number {
  const zeroDecimalCurrencies = ['JPY', 'KRW', 'VND']
  if (zeroDecimalCurrencies.includes(currency.toUpperCase())) {
    return amount
  }
  return amount // Already in smallest unit
}
