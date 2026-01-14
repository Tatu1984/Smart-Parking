import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getOfflineQueue } from '@/lib/sync/offline-queue'

const queue = getOfflineQueue()

/**
 * Get sync status
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const includeOperations = searchParams.get('includeOperations') === 'true'

    const status = queue.getStatus()

    const response: Record<string, unknown> = { status }

    if (includeOperations) {
      response.operations = queue.getQueuedOperations()
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Get sync status error:', error)
    return NextResponse.json(
      { error: 'Failed to get sync status' },
      { status: 500 }
    )
  }
}

/**
 * Perform sync operations
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { action, operationId } = body

    let result: unknown

    switch (action) {
      case 'force':
        result = await queue.forceSync()
        break

      case 'retry':
        if (operationId) {
          result = queue.retryOperation(operationId)
        } else {
          result = queue.retryAllFailed()
        }
        break

      case 'clear-completed':
        result = queue.clearCompleted()
        break

      case 'clear-failed':
        result = queue.clearFailed()
        break

      default:
        return NextResponse.json(
          { error: 'Invalid action. Must be: force, retry, clear-completed, or clear-failed' },
          { status: 400 }
        )
    }

    return NextResponse.json({
      action,
      result,
      status: queue.getStatus()
    })
  } catch (error) {
    console.error('Sync action error:', error)
    return NextResponse.json(
      { error: 'Failed to perform sync action' },
      { status: 500 }
    )
  }
}
