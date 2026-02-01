// Route Configuration
// Centralized route definitions for the application

export const ROUTES = {
  // Public Routes
  HOME: '/',
  ABOUT: '/about',
  PRICING: '/pricing',
  CONTACT: '/contact',
  DOCS: '/docs',
  FIND_CAR: '/find-car',

  // Auth Routes
  LOGIN: '/login',
  REGISTER: '/register',
  FORGOT_PASSWORD: '/forgot-password',
  RESET_PASSWORD: '/reset-password',

  // Dashboard Routes
  DASHBOARD: '/dashboard',
  ANALYTICS: '/dashboard/analytics',
  CAMERAS: '/dashboard/cameras',
  LIVE: '/dashboard/live',
  PARKING_LOTS: '/dashboard/parking-lots',
  REPORTS: '/dashboard/reports',
  SETTINGS: '/dashboard/settings',
  USERS: '/dashboard/settings/users',
  SLOTS: '/dashboard/slots',
  TOKENS: '/dashboard/tokens',
  TRANSACTIONS: '/dashboard/transactions',
  VEHICLES: '/dashboard/vehicles',
  ZONES: '/dashboard/zones',

  // Wallet Routes
  WALLET: '/dashboard/wallet',
  WALLET_BANK_ACCOUNTS: '/dashboard/wallet/bank-accounts',
  WALLET_REQUEST: '/dashboard/wallet/request',
  WALLET_TRANSACTIONS: '/dashboard/wallet/transactions',
  WALLET_TRANSFER: '/dashboard/wallet/transfer',

  // Kiosk Routes
  KIOSK: '/kiosk',

  // Payment Routes
  PAY: (ref: string) => `/pay/${ref}`,
} as const

// Route groups for middleware
export const AUTH_ROUTES = [
  ROUTES.LOGIN,
  ROUTES.REGISTER,
  ROUTES.FORGOT_PASSWORD,
  ROUTES.RESET_PASSWORD,
]

export const PUBLIC_ROUTES = [
  ROUTES.HOME,
  ROUTES.ABOUT,
  ROUTES.PRICING,
  ROUTES.CONTACT,
  ROUTES.DOCS,
  ROUTES.FIND_CAR,
  ROUTES.KIOSK,
]

export const PROTECTED_ROUTES = [
  ROUTES.DASHBOARD,
  ROUTES.ANALYTICS,
  ROUTES.CAMERAS,
  ROUTES.LIVE,
  ROUTES.PARKING_LOTS,
  ROUTES.REPORTS,
  ROUTES.SETTINGS,
  ROUTES.USERS,
  ROUTES.SLOTS,
  ROUTES.TOKENS,
  ROUTES.TRANSACTIONS,
  ROUTES.VEHICLES,
  ROUTES.ZONES,
  ROUTES.WALLET,
  ROUTES.WALLET_BANK_ACCOUNTS,
  ROUTES.WALLET_REQUEST,
  ROUTES.WALLET_TRANSACTIONS,
  ROUTES.WALLET_TRANSFER,
]

// Helper to check if a route requires authentication
export function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_ROUTES.some(route => pathname.startsWith(route))
}

// Helper to check if a route is for unauthenticated users only
export function isAuthRoute(pathname: string): boolean {
  return AUTH_ROUTES.some(route => pathname === route)
}
