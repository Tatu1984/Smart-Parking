import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { HardwareManager } from '@/lib/hardware'
import { logger } from '@/lib/logger'

const hardwareManager = HardwareManager.getInstance()

/**
 * List all gates and their status
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const gates = hardwareManager.listGates()

    // Get status for each gate
    const gatesWithStatus = await Promise.all(
      gates.map(async (gate) => {
        const status = await gate.getStatus()
        return {
          id: gate.id,
          name: gate.name,
          type: gate.type,
          status,
          connected: status?.isOnline ?? false
        }
      })
    )

    return NextResponse.json({ gates: gatesWithStatus })
  } catch (error) {
    logger.error('List gates error', error instanceof Error ? error : undefined)
    return NextResponse.json(
      { error: 'Failed to list gates' },
      { status: 500 }
    )
  }
}

/**
 * Register a new gate
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { id, name, type, config } = body

    if (!id || !name || !type) {
      return NextResponse.json(
        { error: 'id, name, and type are required' },
        { status: 400 }
      )
    }

    const validTypes = ['RS485', 'RELAY', 'HTTP', 'MQTT']
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Invalid type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      )
    }

    hardwareManager.addGate(id, {
      name,
      type,
      ...config
    })

    return NextResponse.json({
      message: 'Gate registered successfully',
      gate: { id, name, type }
    }, { status: 201 })
  } catch (error) {
    logger.error('Register gate error', error instanceof Error ? error : undefined)
    return NextResponse.json(
      { error: 'Failed to register gate' },
      { status: 500 }
    )
  }
}
