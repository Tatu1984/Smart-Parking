import { z } from 'zod'

const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be less than 128 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')

export const mobileRegisterSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().email('Invalid email address'),
  password: passwordSchema,
  phone: z.string().optional(),
})

export const mobileLoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
})

export const updateProfileSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  phone: z.string().optional().nullable(),
  avatar: z.string().url().optional().nullable(),
})

export const createVehicleSchema = z.object({
  licensePlate: z.string().min(1, 'License plate is required').max(20),
  type: z.enum(['car', 'motorcycle', 'suv', 'truck']),
  make: z.string().optional(),
  model: z.string().optional(),
  color: z.string().optional(),
  isDefault: z.boolean().optional(),
})

export const updateVehicleSchema = z.object({
  make: z.string().optional(),
  model: z.string().optional(),
  color: z.string().optional(),
  isDefault: z.boolean().optional(),
})

export const depositSchema = z.object({
  amount: z.number().positive('Amount must be positive').max(100000, 'Maximum deposit is ₹1,00,000'),
})

export const processPaymentSchema = z.object({
  sessionId: z.string().min(1),
  amount: z.number().positive(),
  paymentMethod: z.enum(['WALLET', 'UPI', 'CARD']),
})

export const qrValidateSchema = z.object({
  code: z.string().min(1, 'QR code is required'),
})
