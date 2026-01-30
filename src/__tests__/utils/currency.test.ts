import { describe, it, expect } from 'vitest'
import { formatCurrency, formatAmount, getCurrencySymbol, isValidCurrencyCode } from '@/lib/utils/currency'

describe('Currency Utilities', () => {
  describe('formatCurrency', () => {
    it('should format INR correctly', () => {
      const result = formatCurrency(1000, 'INR')
      expect(result).toContain('1,000')
    })

    it('should format USD correctly', () => {
      const result = formatCurrency(100, 'USD')
      expect(result).toContain('100')
    })

    it('should handle zero amount', () => {
      const result = formatCurrency(0, 'INR')
      expect(result).toContain('0')
    })

    it('should fall back to USD for invalid currency', () => {
      const result = formatCurrency(100, 'INVALID')
      expect(result).toContain('$')
    })
  })

  describe('formatAmount', () => {
    it('should format with symbol before for USD', () => {
      const result = formatAmount(100, 'USD')
      expect(result.startsWith('$')).toBe(true)
    })

    it('should format with symbol for INR', () => {
      const result = formatAmount(1000, 'INR')
      expect(result).toContain('₹')
    })
  })

  describe('getCurrencySymbol', () => {
    it('should return correct symbol for INR', () => {
      expect(getCurrencySymbol('INR')).toBe('₹')
    })

    it('should return correct symbol for USD', () => {
      expect(getCurrencySymbol('USD')).toBe('$')
    })

    it('should return correct symbol for EUR', () => {
      expect(getCurrencySymbol('EUR')).toBe('€')
    })
  })

  describe('isValidCurrencyCode', () => {
    it('should return true for valid currency codes', () => {
      expect(isValidCurrencyCode('INR')).toBe(true)
      expect(isValidCurrencyCode('USD')).toBe(true)
      expect(isValidCurrencyCode('EUR')).toBe(true)
    })

    it('should return false for invalid currency codes', () => {
      expect(isValidCurrencyCode('INVALID')).toBe(false)
      expect(isValidCurrencyCode('XYZ')).toBe(false)
    })
  })
})
