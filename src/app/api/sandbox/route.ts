/**
 * Sandbox API - Configuration and Status
 * Manages sandbox mode settings for demo/testing
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { getSandboxConfig, updateSandboxConfig, isSandboxMode, SANDBOX_CARDS, SANDBOX_UPI, SANDBOX_BANK_ACCOUNTS } from '@/lib/sandbox'

// GET /api/sandbox - Get sandbox configuration
export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const config = getSandboxConfig()

  return NextResponse.json({
    success: true,
    data: {
      config,
      testCredentials: {
        cards: SANDBOX_CARDS,
        upi: SANDBOX_UPI,
        bankAccounts: SANDBOX_BANK_ACCOUNTS,
      },
      demoUsers: [
        { email: 'admin@demo.sparking.io', role: 'ADMIN', password: 'demo123' },
        { email: 'operator@demo.sparking.io', role: 'OPERATOR', password: 'demo123' },
        { email: 'viewer@demo.sparking.io', role: 'VIEWER', password: 'demo123' },
      ],
    },
  })
}

// PATCH /api/sandbox - Update sandbox configuration
export async function PATCH(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Only admin can modify sandbox config
  if (!['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const updatedConfig = updateSandboxConfig(body)

  return NextResponse.json({
    success: true,
    message: 'Sandbox configuration updated',
    data: updatedConfig,
  })
}
