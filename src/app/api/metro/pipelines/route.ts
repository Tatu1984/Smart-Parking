import { NextRequest } from 'next/server'
import { successResponse, handleApiError, errorResponse } from '@/lib/utils/api'
import { getCurrentUser } from '@/lib/auth/session'
import { logger } from '@/lib/logger'
import { z } from 'zod'

const DLSTREAMER_ENDPOINT = process.env.DLSTREAMER_ENDPOINT || 'http://dlstreamer-pipeline-server:8080'

// Schema for starting a pipeline
const startPipelineSchema = z.object({
  pipelineName: z.string().min(1),
  source: z.object({
    uri: z.string().url(),
    type: z.enum(['uri', 'rtsp', 'file']).default('uri'),
  }),
  parameters: z.object({
    'detection-device': z.enum(['CPU', 'GPU', 'AUTO']).optional(),
    'confidence-threshold': z.number().min(0).max(1).optional(),
    'inference-interval': z.number().int().min(1).optional(),
    'mqtt-topic': z.string().optional(),
  }).optional(),
  cameraId: z.string().optional(), // Link to SParking camera
})

// GET /api/metro/pipelines - List all pipelines
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return errorResponse('Unauthorized', 401)
    }

    // Fetch pipelines from DL Streamer
    const response = await fetch(`${DLSTREAMER_ENDPOINT}/pipelines`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const error = await response.text()
      return errorResponse(`DL Streamer error: ${error}`, response.status)
    }

    const pipelines = await response.json()

    // Also fetch running instances (non-critical, log errors but don't fail)
    let runningInstances: unknown[] = []
    try {
      const statusResponse = await fetch(`${DLSTREAMER_ENDPOINT}/pipelines/status`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (statusResponse.ok) {
        runningInstances = await statusResponse.json()
      } else {
        logger.warn('Failed to fetch pipeline status', {
          status: statusResponse.status,
          statusText: statusResponse.statusText,
        })
      }
    } catch (statusError) {
      logger.warn('Error fetching pipeline status', {
        error: statusError instanceof Error ? statusError.message : String(statusError),
      })
    }

    return successResponse({
      available: pipelines,
      running: runningInstances,
    })
  } catch (error) {
    return handleApiError(error)
  }
}

// POST /api/metro/pipelines - Start a new pipeline
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return errorResponse('Unauthorized', 401)
    }

    // Only ADMIN or OPERATOR can start pipelines
    if (!['ADMIN', 'SUPER_ADMIN', 'OPERATOR'].includes(user.role)) {
      return errorResponse('Forbidden', 403)
    }

    const body = await request.json()
    const data = startPipelineSchema.parse(body)

    // Generate MQTT topic if not provided
    const mqttTopic = data.parameters?.['mqtt-topic'] ||
      `object_detection_${data.cameraId || Date.now()}`

    // Build request body for DL Streamer
    const pipelineRequest = {
      source: data.source,
      parameters: {
        ...data.parameters,
        'mqtt-topic': mqttTopic,
      },
    }

    // Start pipeline on DL Streamer
    const response = await fetch(
      `${DLSTREAMER_ENDPOINT}/pipelines/${data.pipelineName}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(pipelineRequest),
      }
    )

    if (!response.ok) {
      const error = await response.text()
      return errorResponse(`Failed to start pipeline: ${error}`, response.status)
    }

    const result = await response.json()

    return successResponse(
      {
        instanceId: result.instance_id || result.id,
        pipelineName: data.pipelineName,
        mqttTopic,
        cameraId: data.cameraId,
        status: 'RUNNING',
      },
      'Pipeline started successfully'
    )
  } catch (error) {
    return handleApiError(error)
  }
}

// DELETE /api/metro/pipelines - Stop a pipeline (using query param for instance ID)
export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return errorResponse('Unauthorized', 401)
    }

    if (!['ADMIN', 'SUPER_ADMIN', 'OPERATOR'].includes(user.role)) {
      return errorResponse('Forbidden', 403)
    }

    const { searchParams } = new URL(request.url)
    const instanceId = searchParams.get('instanceId')
    const pipelineName = searchParams.get('pipelineName')

    if (!instanceId || !pipelineName) {
      return errorResponse('instanceId and pipelineName are required', 400)
    }

    // Stop pipeline on DL Streamer
    const response = await fetch(
      `${DLSTREAMER_ENDPOINT}/pipelines/${pipelineName}/${instanceId}`,
      {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    )

    if (!response.ok) {
      const error = await response.text()
      return errorResponse(`Failed to stop pipeline: ${error}`, response.status)
    }

    return successResponse(
      { instanceId, pipelineName, status: 'STOPPED' },
      'Pipeline stopped successfully'
    )
  } catch (error) {
    return handleApiError(error)
  }
}
