// Supported currencies with their configurations
export const currencies = {
  INR: {
    code: 'INR',
    symbol: '₹',
    name: 'Indian Rupee',
    locale: 'en-IN',
    decimalPlaces: 2,
    symbolPosition: 'before' as const,
  },
  USD: {
    code: 'USD',
    symbol: '$',
    name: 'US Dollar',
    locale: 'en-US',
    decimalPlaces: 2,
    symbolPosition: 'before' as const,
  },
  EUR: {
    code: 'EUR',
    symbol: '€',
    name: 'Euro',
    locale: 'de-DE',
    decimalPlaces: 2,
    symbolPosition: 'before' as const,
  },
  GBP: {
    code: 'GBP',
    symbol: '£',
    name: 'British Pound',
    locale: 'en-GB',
    decimalPlaces: 2,
    symbolPosition: 'before' as const,
  },
  AED: {
    code: 'AED',
    symbol: 'د.إ',
    name: 'UAE Dirham',
    locale: 'ar-AE',
    decimalPlaces: 2,
    symbolPosition: 'before' as const,
  },
  SAR: {
    code: 'SAR',
    symbol: '﷼',
    name: 'Saudi Riyal',
    locale: 'ar-SA',
    decimalPlaces: 2,
    symbolPosition: 'before' as const,
  },
  SGD: {
    code: 'SGD',
    symbol: 'S$',
    name: 'Singapore Dollar',
    locale: 'en-SG',
    decimalPlaces: 2,
    symbolPosition: 'before' as const,
  },
  MYR: {
    code: 'MYR',
    symbol: 'RM',
    name: 'Malaysian Ringgit',
    locale: 'ms-MY',
    decimalPlaces: 2,
    symbolPosition: 'before' as const,
  },
  THB: {
    code: 'THB',
    symbol: '฿',
    name: 'Thai Baht',
    locale: 'th-TH',
    decimalPlaces: 2,
    symbolPosition: 'before' as const,
  },
  JPY: {
    code: 'JPY',
    symbol: '¥',
    name: 'Japanese Yen',
    locale: 'ja-JP',
    decimalPlaces: 0,
    symbolPosition: 'before' as const,
  },
  CNY: {
    code: 'CNY',
    symbol: '¥',
    name: 'Chinese Yuan',
    locale: 'zh-CN',
    decimalPlaces: 2,
    symbolPosition: 'before' as const,
  },
  AUD: {
    code: 'AUD',
    symbol: 'A$',
    name: 'Australian Dollar',
    locale: 'en-AU',
    decimalPlaces: 2,
    symbolPosition: 'before' as const,
  },
  CAD: {
    code: 'CAD',
    symbol: 'C$',
    name: 'Canadian Dollar',
    locale: 'en-CA',
    decimalPlaces: 2,
    symbolPosition: 'before' as const,
  },
  ZAR: {
    code: 'ZAR',
    symbol: 'R',
    name: 'South African Rand',
    locale: 'en-ZA',
    decimalPlaces: 2,
    symbolPosition: 'before' as const,
  },
  BRL: {
    code: 'BRL',
    symbol: 'R$',
    name: 'Brazilian Real',
    locale: 'pt-BR',
    decimalPlaces: 2,
    symbolPosition: 'before' as const,
  },
  MXN: {
    code: 'MXN',
    symbol: '$',
    name: 'Mexican Peso',
    locale: 'es-MX',
    decimalPlaces: 2,
    symbolPosition: 'before' as const,
  },
  KRW: {
    code: 'KRW',
    symbol: '₩',
    name: 'South Korean Won',
    locale: 'ko-KR',
    decimalPlaces: 0,
    symbolPosition: 'before' as const,
  },
  IDR: {
    code: 'IDR',
    symbol: 'Rp',
    name: 'Indonesian Rupiah',
    locale: 'id-ID',
    decimalPlaces: 0,
    symbolPosition: 'before' as const,
  },
  PHP: {
    code: 'PHP',
    symbol: '₱',
    name: 'Philippine Peso',
    locale: 'en-PH',
    decimalPlaces: 2,
    symbolPosition: 'before' as const,
  },
  VND: {
    code: 'VND',
    symbol: '₫',
    name: 'Vietnamese Dong',
    locale: 'vi-VN',
    decimalPlaces: 0,
    symbolPosition: 'after' as const,
  },
} as const

export type CurrencyCode = keyof typeof currencies

export interface CurrencyConfig {
  code: CurrencyCode
  symbol: string
  name: string
  locale: string
  decimalPlaces: number
  symbolPosition: 'before' | 'after'
}

// Format amount in the specified currency
export function formatCurrency(
  amount: number,
  currencyCode: CurrencyCode = 'USD',
  options?: {
    showCode?: boolean
    compact?: boolean
  }
): string {
  const currency = currencies[currencyCode]
  if (!currency) {
    return `${amount}`
  }

  const { showCode = false, compact = false } = options || {}

  // Use Intl.NumberFormat for proper locale-aware formatting
  const formatter = new Intl.NumberFormat(currency.locale, {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: currency.decimalPlaces,
    maximumFractionDigits: currency.decimalPlaces,
    notation: compact ? 'compact' : 'standard',
  })

  let formatted = formatter.format(amount)

  // Optionally append currency code
  if (showCode) {
    formatted = `${formatted} ${currencyCode}`
  }

  return formatted
}

// Format amount with just the symbol (simpler format)
export function formatAmount(
  amount: number,
  currencyCode: CurrencyCode = 'USD'
): string {
  const currency = currencies[currencyCode]
  if (!currency) {
    return `${amount}`
  }

  const formattedNumber = new Intl.NumberFormat(currency.locale, {
    minimumFractionDigits: currency.decimalPlaces,
    maximumFractionDigits: currency.decimalPlaces,
  }).format(amount)

  if (currency.symbolPosition === 'after') {
    return `${formattedNumber}${currency.symbol}`
  }
  return `${currency.symbol}${formattedNumber}`
}

// Get currency symbol only
export function getCurrencySymbol(currencyCode: CurrencyCode): string {
  return currencies[currencyCode]?.symbol || currencyCode
}

// Get all currencies as options for select
export function getCurrencyOptions(): Array<{ value: CurrencyCode; label: string }> {
  return Object.entries(currencies).map(([code, config]) => ({
    value: code as CurrencyCode,
    label: `${config.symbol} ${config.name} (${code})`,
  }))
}

// Supported countries with their default currencies
export const countries = {
  IN: { name: 'India', code: 'IN', currency: 'INR' as CurrencyCode, timezone: 'Asia/Kolkata' },
  US: { name: 'United States', code: 'US', currency: 'USD' as CurrencyCode, timezone: 'America/New_York' },
  GB: { name: 'United Kingdom', code: 'GB', currency: 'GBP' as CurrencyCode, timezone: 'Europe/London' },
  DE: { name: 'Germany', code: 'DE', currency: 'EUR' as CurrencyCode, timezone: 'Europe/Berlin' },
  FR: { name: 'France', code: 'FR', currency: 'EUR' as CurrencyCode, timezone: 'Europe/Paris' },
  AE: { name: 'United Arab Emirates', code: 'AE', currency: 'AED' as CurrencyCode, timezone: 'Asia/Dubai' },
  SA: { name: 'Saudi Arabia', code: 'SA', currency: 'SAR' as CurrencyCode, timezone: 'Asia/Riyadh' },
  SG: { name: 'Singapore', code: 'SG', currency: 'SGD' as CurrencyCode, timezone: 'Asia/Singapore' },
  MY: { name: 'Malaysia', code: 'MY', currency: 'MYR' as CurrencyCode, timezone: 'Asia/Kuala_Lumpur' },
  TH: { name: 'Thailand', code: 'TH', currency: 'THB' as CurrencyCode, timezone: 'Asia/Bangkok' },
  JP: { name: 'Japan', code: 'JP', currency: 'JPY' as CurrencyCode, timezone: 'Asia/Tokyo' },
  CN: { name: 'China', code: 'CN', currency: 'CNY' as CurrencyCode, timezone: 'Asia/Shanghai' },
  AU: { name: 'Australia', code: 'AU', currency: 'AUD' as CurrencyCode, timezone: 'Australia/Sydney' },
  CA: { name: 'Canada', code: 'CA', currency: 'CAD' as CurrencyCode, timezone: 'America/Toronto' },
  ZA: { name: 'South Africa', code: 'ZA', currency: 'ZAR' as CurrencyCode, timezone: 'Africa/Johannesburg' },
  BR: { name: 'Brazil', code: 'BR', currency: 'BRL' as CurrencyCode, timezone: 'America/Sao_Paulo' },
  MX: { name: 'Mexico', code: 'MX', currency: 'MXN' as CurrencyCode, timezone: 'America/Mexico_City' },
  KR: { name: 'South Korea', code: 'KR', currency: 'KRW' as CurrencyCode, timezone: 'Asia/Seoul' },
  ID: { name: 'Indonesia', code: 'ID', currency: 'IDR' as CurrencyCode, timezone: 'Asia/Jakarta' },
  PH: { name: 'Philippines', code: 'PH', currency: 'PHP' as CurrencyCode, timezone: 'Asia/Manila' },
  VN: { name: 'Vietnam', code: 'VN', currency: 'VND' as CurrencyCode, timezone: 'Asia/Ho_Chi_Minh' },
  IT: { name: 'Italy', code: 'IT', currency: 'EUR' as CurrencyCode, timezone: 'Europe/Rome' },
  ES: { name: 'Spain', code: 'ES', currency: 'EUR' as CurrencyCode, timezone: 'Europe/Madrid' },
  NL: { name: 'Netherlands', code: 'NL', currency: 'EUR' as CurrencyCode, timezone: 'Europe/Amsterdam' },
  BE: { name: 'Belgium', code: 'BE', currency: 'EUR' as CurrencyCode, timezone: 'Europe/Brussels' },
  CH: { name: 'Switzerland', code: 'CH', currency: 'EUR' as CurrencyCode, timezone: 'Europe/Zurich' },
  AT: { name: 'Austria', code: 'AT', currency: 'EUR' as CurrencyCode, timezone: 'Europe/Vienna' },
  PL: { name: 'Poland', code: 'PL', currency: 'EUR' as CurrencyCode, timezone: 'Europe/Warsaw' },
  SE: { name: 'Sweden', code: 'SE', currency: 'EUR' as CurrencyCode, timezone: 'Europe/Stockholm' },
  NO: { name: 'Norway', code: 'NO', currency: 'EUR' as CurrencyCode, timezone: 'Europe/Oslo' },
  DK: { name: 'Denmark', code: 'DK', currency: 'EUR' as CurrencyCode, timezone: 'Europe/Copenhagen' },
  FI: { name: 'Finland', code: 'FI', currency: 'EUR' as CurrencyCode, timezone: 'Europe/Helsinki' },
  IE: { name: 'Ireland', code: 'IE', currency: 'EUR' as CurrencyCode, timezone: 'Europe/Dublin' },
  NZ: { name: 'New Zealand', code: 'NZ', currency: 'AUD' as CurrencyCode, timezone: 'Pacific/Auckland' },
  HK: { name: 'Hong Kong', code: 'HK', currency: 'USD' as CurrencyCode, timezone: 'Asia/Hong_Kong' },
  TW: { name: 'Taiwan', code: 'TW', currency: 'USD' as CurrencyCode, timezone: 'Asia/Taipei' },
} as const

export type CountryCode = keyof typeof countries

export function getCountryOptions(): Array<{ value: CountryCode; label: string }> {
  return Object.entries(countries)
    .map(([code, config]) => ({
      value: code as CountryCode,
      label: config.name,
    }))
    .sort((a, b) => a.label.localeCompare(b.label))
}

export function getDefaultCurrency(countryCode: CountryCode): CurrencyCode {
  return countries[countryCode]?.currency || 'USD'
}

export function getTimezone(countryCode: CountryCode): string {
  return countries[countryCode]?.timezone || 'UTC'
}
