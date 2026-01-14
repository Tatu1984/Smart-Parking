/**
 * Sandbox Mode Configuration
 * Enables demo/testing mode with simulated data and services
 */

export interface SandboxConfig {
  enabled: boolean
  simulatePayments: boolean
  simulateCameras: boolean
  simulateDetection: boolean
  simulateGates: boolean
  autoGenerateEvents: boolean
  eventIntervalMs: number
  paymentSuccessRate: number // 0-1
  cameraOnlineRate: number // 0-1
}

// Default sandbox configuration
const defaultConfig: SandboxConfig = {
  enabled: process.env.SANDBOX_MODE === 'true' || process.env.NODE_ENV === 'development',
  simulatePayments: true,
  simulateCameras: true,
  simulateDetection: true,
  simulateGates: true,
  autoGenerateEvents: true,
  eventIntervalMs: 5000, // Generate events every 5 seconds
  paymentSuccessRate: 0.95, // 95% success rate
  cameraOnlineRate: 0.9, // 90% cameras online
}

let currentConfig: SandboxConfig = { ...defaultConfig }

export function getSandboxConfig(): SandboxConfig {
  return { ...currentConfig }
}

export function updateSandboxConfig(updates: Partial<SandboxConfig>): SandboxConfig {
  currentConfig = { ...currentConfig, ...updates }
  return { ...currentConfig }
}

export function isSandboxMode(): boolean {
  return currentConfig.enabled
}

export function resetSandboxConfig(): void {
  currentConfig = { ...defaultConfig }
}

// Sandbox test credit cards
export const SANDBOX_CARDS = {
  success: {
    number: '4111111111111111',
    expiry: '12/28',
    cvv: '123',
    name: 'Test User',
  },
  decline: {
    number: '4000000000000002',
    expiry: '12/28',
    cvv: '123',
    name: 'Declined Card',
  },
  insufficientFunds: {
    number: '4000000000009995',
    expiry: '12/28',
    cvv: '123',
    name: 'No Funds',
  },
}

// Sandbox UPI IDs
export const SANDBOX_UPI = {
  success: 'success@upi',
  failure: 'failure@upi',
  pending: 'pending@upi',
}

// Sandbox bank accounts for testing
export const SANDBOX_BANK_ACCOUNTS = {
  valid: {
    accountNumber: '1234567890123456',
    ifsc: 'SBIN0001234',
    name: 'Test Account Holder',
  },
  invalid: {
    accountNumber: '0000000000000000',
    ifsc: 'INVALID001',
    name: 'Invalid Account',
  },
}

// Vehicle license plates for demo
export const DEMO_VEHICLES = [
  { plate: 'KA01AB1234', type: 'CAR', color: 'White', make: 'Toyota', model: 'Camry' },
  { plate: 'KA02CD5678', type: 'SUV', color: 'Black', make: 'Honda', model: 'CR-V' },
  { plate: 'KA03EF9012', type: 'CAR', color: 'Silver', make: 'Hyundai', model: 'i20' },
  { plate: 'KA04GH3456', type: 'CAR', color: 'Red', make: 'Maruti', model: 'Swift' },
  { plate: 'KA05IJ7890', type: 'SUV', color: 'Blue', make: 'Tata', model: 'Harrier' },
  { plate: 'MH01KL2345', type: 'CAR', color: 'Grey', make: 'Volkswagen', model: 'Polo' },
  { plate: 'MH02MN6789', type: 'CAR', color: 'White', make: 'Kia', model: 'Seltos' },
  { plate: 'TN01OP1234', type: 'MOTORCYCLE', color: 'Black', make: 'Royal Enfield', model: 'Classic 350' },
  { plate: 'DL01QR5678', type: 'CAR', color: 'Brown', make: 'Mahindra', model: 'XUV700' },
  { plate: 'GJ01ST9012', type: 'CAR', color: 'Green', make: 'MG', model: 'Hector' },
]

// Random name generator for demo
export function generateDemoName(): string {
  const firstNames = ['Rahul', 'Priya', 'Amit', 'Sneha', 'Vikram', 'Anjali', 'Raj', 'Deepa', 'Sanjay', 'Meera']
  const lastNames = ['Sharma', 'Patel', 'Kumar', 'Singh', 'Reddy', 'Nair', 'Gupta', 'Verma', 'Joshi', 'Das']
  return `${firstNames[Math.floor(Math.random() * firstNames.length)]} ${lastNames[Math.floor(Math.random() * lastNames.length)]}`
}

// Random phone number generator
export function generateDemoPhone(): string {
  return `+91${Math.floor(7000000000 + Math.random() * 2999999999)}`
}

// Random email generator
export function generateDemoEmail(name: string): string {
  const domains = ['gmail.com', 'yahoo.com', 'outlook.com', 'email.com']
  const cleanName = name.toLowerCase().replace(/\s+/g, '.')
  return `${cleanName}${Math.floor(Math.random() * 1000)}@${domains[Math.floor(Math.random() * domains.length)]}`
}
