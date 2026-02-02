import { NextRequest } from 'next/server'
import { successResponse, handleApiError, errorResponse } from '@/lib/utils/api'
import { getCurrentUser } from '@/lib/auth/session'
import prisma from '@/lib/db'

const FEATURE_MATCHING_ENDPOINT = process.env.FEATURE_MATCHING_ENDPOINT || 'http://feature-matching:8000'

// Interface for search results from feature-matching service
interface FeatureMatchResult {
  id: string
  score: number
  camera_id: string
  vehicle_type: string | null
  vehicle_color: string | null
  license_plate: string | null
  detected_at: number
  confidence: number
  image_url: string
}

interface FeatureMatchResponse {
  success: boolean
  matches: FeatureMatchResult[]
  query_time_ms: number
}

// POST /api/vehicles/search - Search for vehicles by image
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return errorResponse('Unauthorized', 401)
    }

    // Get form data with image
    const formData = await request.formData()
    const image = formData.get('image') as File
    const limitRaw = formData.get('limit')?.toString()
    const cameraIds = formData.get('cameraIds')?.toString()
    const minConfidenceRaw = formData.get('minConfidence')?.toString()

    if (!image) {
      return errorResponse('Image file is required', 400)
    }

    // Validate and sanitize numeric inputs
    const limit = limitRaw ? parseInt(limitRaw, 10) : 10
    if (isNaN(limit) || limit < 1 || limit > 100) {
      return errorResponse('limit must be a number between 1 and 100', 400)
    }

    const minConfidence = minConfidenceRaw ? parseFloat(minConfidenceRaw) : 0
    if (isNaN(minConfidence) || minConfidence < 0 || minConfidence > 1) {
      return errorResponse('minConfidence must be a number between 0 and 1', 400)
    }

    // Validate image type
    if (!image.type.startsWith('image/')) {
      return errorResponse('File must be an image', 400)
    }

    // Validate image size (max 10MB)
    if (image.size > 10 * 1024 * 1024) {
      return errorResponse('Image size must be less than 10MB', 400)
    }

    // Forward request to feature-matching service
    const searchFormData = new FormData()
    searchFormData.append('image', image)

    const searchParams = new URLSearchParams({
      limit: limit.toString(),
      min_confidence: minConfidence.toString(),
    })
    if (cameraIds) {
      searchParams.append('camera_ids', cameraIds)
    }

    const response = await fetch(
      `${FEATURE_MATCHING_ENDPOINT}/search?${searchParams.toString()}`,
      {
        method: 'POST',
        body: searchFormData,
      }
    )

    if (!response.ok) {
      const error = await response.text()
      return errorResponse(`Search service error: ${error}`, response.status)
    }

    const searchResult: FeatureMatchResponse = await response.json()

    // Enrich results with vehicle data from database
    const enrichedMatches = await Promise.all(
      searchResult.matches.map(async (match: FeatureMatchResult) => {
        // Try to find linked vehicle data
        const featureIndex = await prisma.vehicleFeatureIndex.findUnique({
          where: { milvusId: match.id },
          include: {
            vehicle: {
              select: {
                id: true,
                licensePlate: true,
                vehicleType: true,
                make: true,
                model: true,
                color: true,
                isBlacklisted: true,
                isVip: true,
              },
            },
            token: {
              select: {
                id: true,
                tokenNumber: true,
                entryTime: true,
                status: true,
              },
            },
            camera: {
              select: {
                id: true,
                name: true,
                parkingLot: {
                  select: { id: true, name: true },
                },
              },
            },
          },
        })

        return {
          ...match,
          sparking: featureIndex || null,
        }
      })
    )

    return successResponse({
      matches: enrichedMatches,
      queryTimeMs: searchResult.query_time_ms,
      totalMatches: enrichedMatches.length,
    })
  } catch (error) {
    return handleApiError(error)
  }
}

// GET /api/vehicles/search - Get search history or suggestions
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return errorResponse('Unauthorized', 401)
    }

    const { searchParams } = new URL(request.url)
    const licensePlate = searchParams.get('licensePlate')

    if (licensePlate) {
      // Search by license plate in feature indices
      const results = await prisma.vehicleFeatureIndex.findMany({
        where: {
          licensePlate: {
            contains: licensePlate,
            mode: 'insensitive',
          },
        },
        include: {
          vehicle: {
            select: {
              id: true,
              licensePlate: true,
              vehicleType: true,
              make: true,
              model: true,
              color: true,
            },
          },
          camera: {
            select: {
              id: true,
              name: true,
              parkingLot: {
                select: { id: true, name: true },
              },
            },
          },
        },
        orderBy: { detectedAt: 'desc' },
        take: 20,
      })

      return successResponse(results)
    }

    // Return recent indexed vehicles
    const recent = await prisma.vehicleFeatureIndex.findMany({
      include: {
        camera: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { detectedAt: 'desc' },
      take: 50,
    })

    return successResponse(recent)
  } catch (error) {
    return handleApiError(error)
  }
}
