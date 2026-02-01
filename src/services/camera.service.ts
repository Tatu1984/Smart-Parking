// Camera Service
// Handles camera and hardware operations

import { apiClient, API_ENDPOINTS } from '@/lib/api'
import type { Camera } from '@/lib/api/types'

// Types for camera operations
export interface CameraFilters {
  parkingLotId?: string
  zoneId?: string
  status?: string
}

export interface CreateCameraData {
  parkingLotId: string
  zoneId?: string
  name: string
  rtspUrl: string
  onvifUrl?: string
  username?: string
  password?: string
  positionDescription?: string
  coverageSlots?: number
}

export interface GateFilters {
  parkingLotId?: string
  gateType?: string
  status?: string
}

export interface Gate {
  id: string
  parkingLotId: string
  name: string
  gateType: 'ENTRY' | 'EXIT' | 'BIDIRECTIONAL'
  status: 'OPEN' | 'CLOSED' | 'ERROR' | 'MAINTENANCE'
  lastActionAt?: string
}

export interface Display {
  id: string
  parkingLotId: string
  name: string
  displayType: 'LED_COUNTER' | 'LCD_SIGNAGE' | 'KIOSK' | 'DIRECTIONAL'
  status: 'ONLINE' | 'OFFLINE' | 'ERROR'
  currentMessage?: string
}

export const cameraService = {
  // Cameras
  async listCameras(filters?: CameraFilters): Promise<Camera[]> {
    return apiClient.get<Camera[]>(API_ENDPOINTS.CAMERAS.LIST, { params: filters })
  },

  async getCameraById(id: string): Promise<Camera> {
    return apiClient.get<Camera>(API_ENDPOINTS.CAMERAS.BY_ID(id))
  },

  async createCamera(data: CreateCameraData): Promise<Camera> {
    return apiClient.post<Camera>(API_ENDPOINTS.CAMERAS.CREATE, data)
  },

  async updateCamera(id: string, data: Partial<CreateCameraData>): Promise<Camera> {
    return apiClient.patch<Camera>(API_ENDPOINTS.CAMERAS.UPDATE(id), data)
  },

  async deleteCamera(id: string): Promise<void> {
    await apiClient.delete(API_ENDPOINTS.CAMERAS.DELETE(id))
  },

  async getCameraSnapshot(id: string): Promise<{ imageUrl: string; timestamp: string }> {
    return apiClient.get(API_ENDPOINTS.CAMERAS.SNAPSHOT(id))
  },

  async getCameraStreamUrl(id: string): Promise<{ streamUrl: string; type: string }> {
    return apiClient.get(API_ENDPOINTS.CAMERAS.STREAM(id))
  },

  // Gates
  async listGates(filters?: GateFilters): Promise<Gate[]> {
    return apiClient.get<Gate[]>(API_ENDPOINTS.GATES.LIST, { params: filters })
  },

  async getGateById(id: string): Promise<Gate> {
    return apiClient.get<Gate>(API_ENDPOINTS.GATES.BY_ID(id))
  },

  async openGate(id: string): Promise<Gate> {
    return apiClient.post<Gate>(API_ENDPOINTS.GATES.OPEN(id))
  },

  async closeGate(id: string): Promise<Gate> {
    return apiClient.post<Gate>(API_ENDPOINTS.GATES.CLOSE(id))
  },

  // Displays
  async listDisplays(parkingLotId?: string): Promise<Display[]> {
    return apiClient.get<Display[]>(API_ENDPOINTS.DISPLAYS.LIST, {
      params: parkingLotId ? { parkingLotId } : undefined,
    })
  },

  async getDisplayById(id: string): Promise<Display> {
    return apiClient.get<Display>(API_ENDPOINTS.DISPLAYS.BY_ID(id))
  },

  async updateDisplayMessage(id: string, message: string): Promise<Display> {
    return apiClient.post<Display>(API_ENDPOINTS.DISPLAYS.UPDATE_MESSAGE(id), { message })
  },
}
