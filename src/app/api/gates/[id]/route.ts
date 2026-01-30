import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { HardwareManager } from '@/lib/hardware'
import { logger } from '@/lib/logger'

const hardwareManager = HardwareManager.getInstance()

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * Get gate status
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const gate = hardwareManager.getGate(id)

    if (!gate) {
      return NextResponse.json(
        { error: 'Gate not found' },
        { status: 404 }
      )
    }

    const status = await gate.getStatus()

    return NextResponse.json({
      id: gate.id,
      name: gate.name,
      type: gate.type,
      status
    })
  } catch (error) {
    logger.error('Get gate status error', error instanceof Error ? error : undefined)
    return NextResponse.json(
      { error: 'Failed to get gate status' },
      { status: 500 }
    )
  }
}

/**
 * Control gate (open/close)
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const { action, duration } = body

    const gate = hardwareManager.getGate(id)

    if (!gate) {
      return NextResponse.json(
        { error: 'Gate not found' },
        { status: 404 }
      )
    }

    let success = false

    switch (action) {
      case 'open':
        success = await gate.open(duration)
        break
      case 'close':
        success = await gate.close()
        break
      case 'stop':
        success = await gate.stop()
        break
      default:
        return NextResponse.json(
          { error: 'Invalid action. Must be: open, close, or stop' },
          { status: 400 }
        )
    }

    if (!success) {
      return NextResponse.json(
        { error: `Failed to ${action} gate` },
        { status: 500 }
      )
    }

    const status = await gate.getStatus()

    return NextResponse.json({
      message: `Gate ${action} command sent successfully`,
      status
    })
  } catch (error) {
    logger.error('Control gate error', error instanceof Error ? error : undefined)
    return NextResponse.json(
      { error: 'Failed to control gate' },
      { status: 500 }
    )
  }
}

/**
 * Remove gate
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const gate = hardwareManager.getGate(id)

    if (!gate) {
      return NextResponse.json(
        { error: 'Gate not found' },
        { status: 404 }
      )
    }

    await gate.disconnect()
    hardwareManager.removeGate(id)

    return NextResponse.json({ message: 'Gate removed successfully' })
  } catch (error) {
    logger.error('Remove gate error', error instanceof Error ? error : undefined)
    return NextResponse.json(
      { error: 'Failed to remove gate' },
      { status: 500 }
    )
  }
}
