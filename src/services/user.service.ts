// User Service
// Handles user profile and management operations

import { apiClient, API_ENDPOINTS } from '@/lib/api'
import type { UserProfile, PaginatedResponse } from '@/lib/api/types'

export interface UpdateProfileData {
  name?: string
  phone?: string
  avatar?: string
}

export interface CreateUserData {
  email: string
  name: string
  password: string
  role: string
  phone?: string
  organizationId: string
}

export interface UserFilters {
  page?: number
  pageSize?: number
  role?: string
  status?: string
  search?: string
  organizationId?: string
}

export const userService = {
  /**
   * Get current user profile
   */
  async getCurrentUser(): Promise<UserProfile> {
    return apiClient.get<UserProfile>(API_ENDPOINTS.AUTH.ME)
  },

  /**
   * Update current user profile
   */
  async updateProfile(data: UpdateProfileData): Promise<UserProfile> {
    return apiClient.patch<UserProfile>(API_ENDPOINTS.USERS.UPDATE('me'), data)
  },

  /**
   * List all users (admin)
   */
  async listUsers(filters?: UserFilters): Promise<PaginatedResponse<UserProfile>> {
    return apiClient.get<PaginatedResponse<UserProfile>>(API_ENDPOINTS.USERS.LIST, {
      params: filters,
    })
  },

  /**
   * Get user by ID
   */
  async getUserById(id: string): Promise<UserProfile> {
    return apiClient.get<UserProfile>(API_ENDPOINTS.USERS.BY_ID(id))
  },

  /**
   * Create new user (admin)
   */
  async createUser(data: CreateUserData): Promise<UserProfile> {
    return apiClient.post<UserProfile>(API_ENDPOINTS.USERS.CREATE, data)
  },

  /**
   * Update user (admin)
   */
  async updateUser(id: string, data: Partial<CreateUserData>): Promise<UserProfile> {
    return apiClient.patch<UserProfile>(API_ENDPOINTS.USERS.UPDATE(id), data)
  },

  /**
   * Delete user (admin)
   */
  async deleteUser(id: string): Promise<void> {
    await apiClient.delete(API_ENDPOINTS.USERS.DELETE(id))
  },

  /**
   * Change user status
   */
  async changeUserStatus(id: string, status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED'): Promise<UserProfile> {
    return apiClient.patch<UserProfile>(API_ENDPOINTS.USERS.UPDATE(id), { status })
  },
}
