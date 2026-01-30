import { describe, it, expect } from 'vitest'
import { loginSchema, createUserSchema, createParkingLotSchema } from '@/lib/validators'

describe('Validation Schemas', () => {
  describe('loginSchema', () => {
    it('should validate correct login data', () => {
      const result = loginSchema.safeParse({
        email: 'test@example.com',
        password: 'ValidPass123',
      })
      expect(result.success).toBe(true)
    })

    it('should reject invalid email', () => {
      const result = loginSchema.safeParse({
        email: 'invalid-email',
        password: 'ValidPass123',
      })
      expect(result.success).toBe(false)
    })

    it('should require password', () => {
      const result = loginSchema.safeParse({
        email: 'test@example.com',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('createUserSchema', () => {
    it('should validate correct user data', () => {
      const result = createUserSchema.safeParse({
        email: 'newuser@example.com',
        password: 'StrongPass123',
        name: 'John Doe',
        role: 'OPERATOR',
        organizationId: 'clxxxxxxxxxxxxxxxxxxxxxxxxx', // CUID format
      })
      expect(result.success).toBe(true)
    })

    it('should reject invalid email', () => {
      const result = createUserSchema.safeParse({
        email: 'invalid',
        password: 'StrongPass123',
        name: 'John Doe',
        role: 'OPERATOR',
      })
      expect(result.success).toBe(false)
    })

    it('should reject invalid role', () => {
      const result = createUserSchema.safeParse({
        email: 'newuser@example.com',
        password: 'StrongPass123',
        name: 'John Doe',
        role: 'INVALID_ROLE',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('createParkingLotSchema', () => {
    it('should validate correct parking lot data', () => {
      const result = createParkingLotSchema.safeParse({
        name: 'Test Parking Lot',
        slug: 'test-parking-lot',
        venueType: 'MALL',
        country: 'India',
      })
      expect(result.success).toBe(true)
    })

    it('should reject missing required fields', () => {
      const result = createParkingLotSchema.safeParse({
        name: 'Test Parking Lot',
      })
      expect(result.success).toBe(false)
    })

    it('should accept optional fields', () => {
      const result = createParkingLotSchema.safeParse({
        name: 'Test Parking Lot',
        slug: 'test-parking-lot',
        venueType: 'MALL',
        country: 'India',
        city: 'Bangalore',
        hasEvCharging: true,
        hasValetService: false,
      })
      expect(result.success).toBe(true)
    })
  })
})
