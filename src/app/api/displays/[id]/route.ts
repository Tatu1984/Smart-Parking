import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { HardwareManager } from '@/lib/hardware'

const hardwareManager = HardwareManager.getInstance()

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * Get display status
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const display = hardwareManager.getDisplay(id)

    if (!display) {
      return NextResponse.json(
        { error: 'Display not found' },
        { status: 404 }
      )
    }

    const status = await display.getStatus()

    return NextResponse.json({
      id: display.id,
      name: display.name,
      type: display.type,
      status
    })
  } catch (error) {
    console.error('Get display status error:', error)
    return NextResponse.json(
      { error: 'Failed to get display status' },
      { status: 500 }
    )
  }
}

/**
 * Update display content
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const { action, message, available, total, zones } = body

    const display = hardwareManager.getDisplay(id)

    if (!display) {
      return NextResponse.json(
        { error: 'Display not found' },
        { status: 404 }
      )
    }

    let success = false

    switch (action) {
      case 'message':
        if (!message) {
          return NextResponse.json(
            { error: 'message is required for message action' },
            { status: 400 }
          )
        }
        success = await display.showMessage(message)
        break

      case 'availability':
        if (available === undefined || total === undefined) {
          return NextResponse.json(
            { error: 'available and total are required for availability action' },
            { status: 400 }
          )
        }
        success = await display.updateAvailability(available, total)
        break

      case 'zones':
        if (!zones || !Array.isArray(zones)) {
          return NextResponse.json(
            { error: 'zones array is required for zones action' },
            { status: 400 }
          )
        }
        success = await display.showZoneAvailability(zones)
        break

      case 'clear':
        success = await display.clear()
        break

      default:
        return NextResponse.json(
          { error: 'Invalid action. Must be: message, availability, zones, or clear' },
          { status: 400 }
        )
    }

    if (!success) {
      return NextResponse.json(
        { error: `Failed to perform ${action} action` },
        { status: 500 }
      )
    }

    const status = await display.getStatus()

    return NextResponse.json({
      message: `Display ${action} action completed successfully`,
      status
    })
  } catch (error) {
    console.error('Update display error:', error)
    return NextResponse.json(
      { error: 'Failed to update display' },
      { status: 500 }
    )
  }
}

/**
 * Remove display
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const display = hardwareManager.getDisplay(id)

    if (!display) {
      return NextResponse.json(
        { error: 'Display not found' },
        { status: 404 }
      )
    }

    await display.disconnect()
    hardwareManager.removeDisplay(id)

    return NextResponse.json({ message: 'Display removed successfully' })
  } catch (error) {
    console.error('Remove display error:', error)
    return NextResponse.json(
      { error: 'Failed to remove display' },
      { status: 500 }
    )
  }
}
