// Authentication Service
// Handles all authentication-related operations

import { apiClient, API_ENDPOINTS } from '@/lib/api'
import type { LoginRequest, LoginResponse, MicrosoftLoginRequest, UserProfile } from '@/lib/api/types'

export const authService = {
  /**
   * Login with email and password
   */
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    return apiClient.post<LoginResponse>(API_ENDPOINTS.AUTH.LOGIN, credentials)
  },

  /**
   * Login with Microsoft account
   */
  async loginWithMicrosoft(data: MicrosoftLoginRequest): Promise<LoginResponse> {
    return apiClient.post<LoginResponse>(API_ENDPOINTS.AUTH.MICROSOFT, data)
  },

  /**
   * Logout current user
   */
  async logout(): Promise<void> {
    await apiClient.post(API_ENDPOINTS.AUTH.LOGOUT)
  },

  /**
   * Get current authenticated user
   */
  async getCurrentUser(): Promise<UserProfile> {
    return apiClient.get<UserProfile>(API_ENDPOINTS.AUTH.ME)
  },

  /**
   * Request password reset
   */
  async forgotPassword(email: string): Promise<void> {
    await apiClient.post(API_ENDPOINTS.AUTH.FORGOT_PASSWORD, { email })
  },

  /**
   * Reset password with token
   */
  async resetPassword(token: string, password: string): Promise<void> {
    await apiClient.post(API_ENDPOINTS.AUTH.RESET_PASSWORD, { token, password })
  },

  /**
   * Check if user is authenticated (by checking if /auth/me succeeds)
   */
  async isAuthenticated(): Promise<boolean> {
    try {
      await this.getCurrentUser()
      return true
    } catch {
      return false
    }
  },
}
