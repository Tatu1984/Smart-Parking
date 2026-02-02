import { NextRequest } from 'next/server'
import { successResponse, handleApiError, errorResponse } from '@/lib/utils/api'
import { getCurrentUser } from '@/lib/auth/session'

const DLSTREAMER_ENDPOINT = process.env.DLSTREAMER_ENDPOINT || 'http://dlstreamer-pipeline-server:8080'

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/metro/pipelines/[id] - Get pipeline instance status
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const user = await getCurrentUser()
    if (!user) {
      return errorResponse('Unauthorized', 401)
    }

    const { searchParams } = new URL(request.url)
    const pipelineName = searchParams.get('pipelineName') || 'sparking_vehicle_detection'

    // Get pipeline status from DL Streamer
    const response = await fetch(
      `${DLSTREAMER_ENDPOINT}/pipelines/${pipelineName}/${id}/status`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    )

    if (!response.ok) {
      if (response.status === 404) {
        return errorResponse('Pipeline instance not found', 404)
      }
      const error = await response.text()
      return errorResponse(`DL Streamer error: ${error}`, response.status)
    }

    const status = await response.json()

    return successResponse({
      instanceId: id,
      pipelineName,
      ...status,
    })
  } catch (error) {
    return handleApiError(error)
  }
}

// DELETE /api/metro/pipelines/[id] - Stop a specific pipeline instance
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const user = await getCurrentUser()
    if (!user) {
      return errorResponse('Unauthorized', 401)
    }

    if (!['ADMIN', 'SUPER_ADMIN', 'OPERATOR'].includes(user.role)) {
      return errorResponse('Forbidden', 403)
    }

    const { searchParams } = new URL(request.url)
    const pipelineName = searchParams.get('pipelineName') || 'sparking_vehicle_detection'

    // Stop pipeline on DL Streamer
    const response = await fetch(
      `${DLSTREAMER_ENDPOINT}/pipelines/${pipelineName}/${id}`,
      {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    )

    if (!response.ok) {
      if (response.status === 404) {
        return errorResponse('Pipeline instance not found', 404)
      }
      const error = await response.text()
      return errorResponse(`Failed to stop pipeline: ${error}`, response.status)
    }

    return successResponse(
      { instanceId: id, pipelineName, status: 'STOPPED' },
      'Pipeline stopped successfully'
    )
  } catch (error) {
    return handleApiError(error)
  }
}
