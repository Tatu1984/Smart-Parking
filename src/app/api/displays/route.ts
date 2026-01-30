import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { HardwareManager } from '@/lib/hardware'
import { logger } from '@/lib/logger'

const hardwareManager = HardwareManager.getInstance()

/**
 * List all displays and their status
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const displays = hardwareManager.listDisplays()

    const displaysWithStatus = await Promise.all(
      displays.map(async (display) => {
        const status = await display.getStatus()
        return {
          id: display.id,
          name: display.name,
          type: display.type,
          status,
          connected: status.connected
        }
      })
    )

    return NextResponse.json({ displays: displaysWithStatus })
  } catch (error) {
    logger.error('List displays error', error instanceof Error ? error : undefined)
    return NextResponse.json(
      { error: 'Failed to list displays' },
      { status: 500 }
    )
  }
}

/**
 * Register a new display
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

    const validTypes = ['SERIAL', 'HTTP', 'UDP']
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Invalid type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      )
    }

    hardwareManager.addDisplay(id, {
      name,
      type,
      ...config
    })

    return NextResponse.json({
      message: 'Display registered successfully',
      display: { id, name, type }
    }, { status: 201 })
  } catch (error) {
    logger.error('Register display error', error instanceof Error ? error : undefined)
    return NextResponse.json(
      { error: 'Failed to register display' },
      { status: 500 }
    )
  }
}
