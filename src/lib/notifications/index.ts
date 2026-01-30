/**
 * Notification Service
 * Handles email, SMS, and push notifications
 */

import { logger } from '@/lib/logger'

export type NotificationType =
  | 'PAYMENT_SUCCESS'
  | 'PAYMENT_FAILED'
  | 'SESSION_START'
  | 'SESSION_END'
  | 'OVERSTAY_WARNING'
  | 'OVERSTAY_ALERT'
  | 'SLOT_RESERVED'
  | 'RESERVATION_EXPIRING'
  | 'SYSTEM_ALERT'
  | 'WELCOME'
  | 'PASSWORD_RESET'

export interface NotificationPayload {
  type: NotificationType
  userId?: string
  email?: string
  phone?: string
  title: string
  message: string
  data?: Record<string, unknown>
}

export interface NotificationResult {
  success: boolean
  channel: 'email' | 'sms' | 'push' | 'in-app'
  messageId?: string
  error?: string
}

// Email templates
const EMAIL_TEMPLATES: Record<NotificationType, { subject: string; template: string }> = {
  PAYMENT_SUCCESS: {
    subject: 'Payment Successful - Sparking',
    template: 'payment-success'
  },
  PAYMENT_FAILED: {
    subject: 'Payment Failed - Sparking',
    template: 'payment-failed'
  },
  SESSION_START: {
    subject: 'Parking Session Started',
    template: 'session-start'
  },
  SESSION_END: {
    subject: 'Parking Session Ended - Receipt',
    template: 'session-end'
  },
  OVERSTAY_WARNING: {
    subject: 'Overstay Warning - Please Exit Soon',
    template: 'overstay-warning'
  },
  OVERSTAY_ALERT: {
    subject: 'Overstay Alert - Additional Charges Applied',
    template: 'overstay-alert'
  },
  SLOT_RESERVED: {
    subject: 'Parking Slot Reserved',
    template: 'slot-reserved'
  },
  RESERVATION_EXPIRING: {
    subject: 'Reservation Expiring Soon',
    template: 'reservation-expiring'
  },
  SYSTEM_ALERT: {
    subject: 'System Alert - Sparking',
    template: 'system-alert'
  },
  WELCOME: {
    subject: 'Welcome to Sparking',
    template: 'welcome'
  },
  PASSWORD_RESET: {
    subject: 'Password Reset Request',
    template: 'password-reset'
  }
}

/**
 * Send notification via multiple channels
 */
export async function sendNotification(
  payload: NotificationPayload
): Promise<NotificationResult[]> {
  const results: NotificationResult[] = []

  // Send email if email provided
  if (payload.email) {
    const emailResult = await sendEmail(payload)
    results.push(emailResult)
  }

  // Send SMS if phone provided
  if (payload.phone) {
    const smsResult = await sendSMS(payload)
    results.push(smsResult)
  }

  // Store in-app notification if userId provided
  if (payload.userId) {
    const inAppResult = await storeInAppNotification(payload)
    results.push(inAppResult)
  }

  return results
}

/**
 * Send email notification
 */
export async function sendEmail(payload: NotificationPayload): Promise<NotificationResult> {
  try {
    const template = EMAIL_TEMPLATES[payload.type]

    // Check for email service configuration
    const emailProvider = process.env.EMAIL_PROVIDER || 'console'

    if (emailProvider === 'resend') {
      return await sendViaResend(payload, template)
    } else if (emailProvider === 'sendgrid') {
      return await sendViaSendGrid(payload, template)
    } else if (emailProvider === 'smtp') {
      return await sendViaSMTP(payload, template)
    } else {
      // Console logging for development
      logger.debug('[Email Notification]', {
        to: payload.email,
        subject: template.subject,
        message: payload.message,
        data: payload.data
      })
      return {
        success: true,
        channel: 'email',
        messageId: `dev-${Date.now()}`
      }
    }
  } catch (error) {
    logger.error('Email send error:', error instanceof Error ? error : undefined)
    return {
      success: false,
      channel: 'email',
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Send email via Resend
 */
async function sendViaResend(
  payload: NotificationPayload,
  template: { subject: string; template: string }
): Promise<NotificationResult> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    throw new Error('RESEND_API_KEY not configured')
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || 'Sparking <noreply@sparking.app>',
      to: payload.email,
      subject: template.subject,
      html: generateEmailHTML(payload, template.template)
    })
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Resend API error: ${error}`)
  }

  const result = await response.json()
  return {
    success: true,
    channel: 'email',
    messageId: result.id
  }
}

/**
 * Send email via SendGrid
 */
async function sendViaSendGrid(
  payload: NotificationPayload,
  template: { subject: string; template: string }
): Promise<NotificationResult> {
  const apiKey = process.env.SENDGRID_API_KEY
  if (!apiKey) {
    throw new Error('SENDGRID_API_KEY not configured')
  }

  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: payload.email }] }],
      from: { email: process.env.EMAIL_FROM || 'noreply@sparking.app' },
      subject: template.subject,
      content: [{
        type: 'text/html',
        value: generateEmailHTML(payload, template.template)
      }]
    })
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`SendGrid API error: ${error}`)
  }

  return {
    success: true,
    channel: 'email',
    messageId: response.headers.get('X-Message-Id') || undefined
  }
}

/**
 * Send email via SMTP (using nodemailer)
 */
async function sendViaSMTP(
  payload: NotificationPayload,
  template: { subject: string; template: string }
): Promise<NotificationResult> {
  try {
    const nodemailer = await import('nodemailer')

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    })

    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || 'Sparking <noreply@sparking.app>',
      to: payload.email,
      subject: template.subject,
      html: generateEmailHTML(payload, template.template)
    })

    return {
      success: true,
      channel: 'email',
      messageId: info.messageId
    }
  } catch (error) {
    throw error
  }
}

/**
 * Send SMS notification
 */
export async function sendSMS(payload: NotificationPayload): Promise<NotificationResult> {
  try {
    const smsProvider = process.env.SMS_PROVIDER || 'console'

    if (smsProvider === 'twilio') {
      return await sendViaTwilio(payload)
    } else if (smsProvider === 'msg91') {
      return await sendViaMsg91(payload)
    } else {
      // Console logging for development
      logger.debug('[SMS Notification]', {
        to: payload.phone,
        message: payload.message
      })
      return {
        success: true,
        channel: 'sms',
        messageId: `dev-${Date.now()}`
      }
    }
  } catch (error) {
    logger.error('SMS send error:', error instanceof Error ? error : undefined)
    return {
      success: false,
      channel: 'sms',
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Send SMS via Twilio
 */
async function sendViaTwilio(payload: NotificationPayload): Promise<NotificationResult> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const fromNumber = process.env.TWILIO_PHONE_NUMBER

  if (!accountSid || !authToken || !fromNumber) {
    throw new Error('Twilio credentials not configured')
  }

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        To: payload.phone!,
        From: fromNumber,
        Body: payload.message
      })
    }
  )

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Twilio API error: ${error}`)
  }

  const result = await response.json()
  return {
    success: true,
    channel: 'sms',
    messageId: result.sid
  }
}

/**
 * Send SMS via MSG91 (India)
 */
async function sendViaMsg91(payload: NotificationPayload): Promise<NotificationResult> {
  const authKey = process.env.MSG91_AUTH_KEY
  const senderId = process.env.MSG91_SENDER_ID
  const templateId = process.env.MSG91_TEMPLATE_ID

  if (!authKey || !senderId) {
    throw new Error('MSG91 credentials not configured')
  }

  const response = await fetch('https://api.msg91.com/api/v5/flow/', {
    method: 'POST',
    headers: {
      'authkey': authKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      flow_id: templateId,
      sender: senderId,
      mobiles: payload.phone?.replace(/^\+91/, ''),
      VAR1: payload.message
    })
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`MSG91 API error: ${error}`)
  }

  const result = await response.json()
  return {
    success: true,
    channel: 'sms',
    messageId: result.request_id
  }
}

/**
 * Store in-app notification
 */
async function storeInAppNotification(
  payload: NotificationPayload
): Promise<NotificationResult> {
  try {
    // Import prisma dynamically to avoid circular dependencies
    const { prisma } = await import('@/lib/db')

    await prisma.notification.create({
      data: {
        userId: payload.userId!,
        type: payload.type,
        title: payload.title,
        message: payload.message,
        data: payload.data as any,
        read: false
      }
    })

    return {
      success: true,
      channel: 'in-app'
    }
  } catch (error) {
    logger.error('In-app notification error:', error instanceof Error ? error : undefined)
    return {
      success: false,
      channel: 'in-app',
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Generate email HTML from template
 */
function generateEmailHTML(payload: NotificationPayload, templateName: string): string {
  const baseStyles = `
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    max-width: 600px;
    margin: 0 auto;
    padding: 20px;
  `

  const headerStyles = `
    background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
    color: white;
    padding: 30px;
    text-align: center;
    border-radius: 8px 8px 0 0;
  `

  const contentStyles = `
    background: #ffffff;
    padding: 30px;
    border: 1px solid #e5e7eb;
    border-top: none;
    border-radius: 0 0 8px 8px;
  `

  const buttonStyles = `
    display: inline-block;
    background: #6366f1;
    color: white;
    padding: 12px 24px;
    border-radius: 6px;
    text-decoration: none;
    margin-top: 20px;
  `

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="${baseStyles}">
      <div style="${headerStyles}">
        <h1 style="margin: 0; font-size: 24px;">Sparking</h1>
        <p style="margin: 10px 0 0; opacity: 0.9;">Smart Parking Management</p>
      </div>
      <div style="${contentStyles}">
        <h2 style="color: #1f2937; margin-top: 0;">${payload.title}</h2>
        <p style="color: #4b5563; line-height: 1.6;">${payload.message}</p>
        ${payload.data ? formatDataSection(payload.data) : ''}
        <p style="color: #6b7280; font-size: 14px; margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 20px;">
          If you have any questions, please contact our support team.
        </p>
      </div>
    </body>
    </html>
  `
}

function formatDataSection(data: Record<string, unknown>): string {
  const items = Object.entries(data)
    .filter(([key]) => !key.startsWith('_'))
    .map(([key, value]) => {
      const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())
      return `<tr>
        <td style="padding: 8px 0; color: #6b7280;">${label}</td>
        <td style="padding: 8px 0; color: #1f2937; font-weight: 500;">${value}</td>
      </tr>`
    })
    .join('')

  if (!items) return ''

  return `
    <table style="width: 100%; margin-top: 20px; border-collapse: collapse;">
      ${items}
    </table>
  `
}

// Convenience functions for common notifications
export async function notifyPaymentSuccess(
  email: string,
  data: { amount: number; tokenId: string; parkingLot: string }
) {
  return sendNotification({
    type: 'PAYMENT_SUCCESS',
    email,
    title: 'Payment Successful',
    message: `Your payment of ₹${data.amount} has been processed successfully.`,
    data
  })
}

export async function notifySessionEnd(
  email: string,
  data: { duration: string; amount: number; parkingLot: string; slot: string }
) {
  return sendNotification({
    type: 'SESSION_END',
    email,
    title: 'Parking Session Ended',
    message: `Your parking session has ended. Duration: ${data.duration}. Amount: ₹${data.amount}`,
    data
  })
}

export async function notifyOverstayWarning(
  email: string,
  phone: string | undefined,
  data: { slotNumber: string; parkingLot: string; warningMinutes: number }
) {
  return sendNotification({
    type: 'OVERSTAY_WARNING',
    email,
    phone,
    title: 'Overstay Warning',
    message: `Please exit within ${data.warningMinutes} minutes to avoid additional charges.`,
    data
  })
}
