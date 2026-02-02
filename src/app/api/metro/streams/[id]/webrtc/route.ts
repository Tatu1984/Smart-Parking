import { NextRequest } from 'next/server'
import { successResponse, handleApiError, errorResponse } from '@/lib/utils/api'
import { getCurrentUser } from '@/lib/auth/session'

const MEDIAMTX_ENDPOINT = process.env.MEDIAMTX_ENDPOINT || 'http://mediamtx:8889'
const TURN_SERVER = process.env.WEBRTC_ICE_SERVERS || 'turn:localhost:3478'
const TURN_USERNAME = process.env.TURN_USERNAME || 'sparking'
const TURN_PASSWORD = process.env.TURN_PASSWORD || 'sparking_secret'

// ICE server configuration types
interface StunServer {
  urls: string[]
}

interface TurnServer {
  urls: string[]
  username: string
  credential: string
}

type ICEServer = StunServer | TurnServer

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/metro/streams/[id]/webrtc - Get WebRTC streaming configuration
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const user = await getCurrentUser()
    if (!user) {
      return errorResponse('Unauthorized', 401)
    }

    // Build WHEP endpoint URL for WebRTC playback
    // MediaMTX uses WHEP (WebRTC-HTTP Egress Protocol) for playback
    const whepEndpoint = `${MEDIAMTX_ENDPOINT}/${id}/whep`

    // ICE server configuration for NAT traversal
    const iceServers: ICEServer[] = [
      {
        urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'],
      },
    ]

    // Add TURN server if configured
    if (TURN_SERVER && TURN_SERVER !== 'turn:localhost:3478') {
      const turnServer: TurnServer = {
        urls: [TURN_SERVER],
        username: TURN_USERNAME,
        credential: TURN_PASSWORD,
      }
      iceServers.push(turnServer)
    }

    return successResponse({
      streamId: id,
      whepEndpoint,
      // Alternative: direct WebRTC signaling endpoint
      webrtcEndpoint: `${MEDIAMTX_ENDPOINT}/${id}/webrtc`,
      iceServers,
      // Stream info
      protocol: 'WHEP',
      mediaType: 'video/h264',
    })
  } catch (error) {
    return handleApiError(error)
  }
}

// POST /api/metro/streams/[id]/webrtc - Initialize WebRTC session (WHEP offer)
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const user = await getCurrentUser()
    if (!user) {
      return errorResponse('Unauthorized', 401)
    }

    // Get SDP offer from request body
    const body = await request.text()
    const contentType = request.headers.get('content-type')

    if (!contentType?.includes('application/sdp')) {
      return errorResponse('Content-Type must be application/sdp', 400)
    }

    // Forward WHEP offer to MediaMTX
    const response = await fetch(`${MEDIAMTX_ENDPOINT}/${id}/whep`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/sdp',
      },
      body,
    })

    if (!response.ok) {
      if (response.status === 404) {
        return errorResponse('Stream not found', 404)
      }
      const error = await response.text()
      return errorResponse(`WebRTC negotiation failed: ${error}`, response.status)
    }

    // Return SDP answer
    const sdpAnswer = await response.text()
    const location = response.headers.get('Location')

    return new Response(sdpAnswer, {
      status: 201,
      headers: {
        'Content-Type': 'application/sdp',
        ...(location && { Location: location }),
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}

// PATCH /api/metro/streams/[id]/webrtc - Handle ICE candidate exchange
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const user = await getCurrentUser()
    if (!user) {
      return errorResponse('Unauthorized', 401)
    }

    const body = await request.text()

    // Forward ICE candidate to MediaMTX
    const response = await fetch(`${MEDIAMTX_ENDPOINT}/${id}/whep`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/trickle-ice-sdpfrag',
      },
      body,
    })

    if (!response.ok) {
      const error = await response.text()
      return errorResponse(`ICE exchange failed: ${error}`, response.status)
    }

    return new Response(null, { status: 204 })
  } catch (error) {
    return handleApiError(error)
  }
}

// DELETE /api/metro/streams/[id]/webrtc - Close WebRTC session
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const user = await getCurrentUser()
    if (!user) {
      return errorResponse('Unauthorized', 401)
    }

    // Close WHEP session on MediaMTX
    const response = await fetch(`${MEDIAMTX_ENDPOINT}/${id}/whep`, {
      method: 'DELETE',
    })

    if (!response.ok && response.status !== 404) {
      const error = await response.text()
      return errorResponse(`Failed to close session: ${error}`, response.status)
    }

    return successResponse({ streamId: id, status: 'closed' })
  } catch (error) {
    return handleApiError(error)
  }
}
