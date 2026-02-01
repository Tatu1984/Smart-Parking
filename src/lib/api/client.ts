// API Client
// Single source of truth for all backend communication

import { getApiBaseUrl, API_CONFIG } from '@/config/api.config'
import { InterceptorManager } from './interceptors'
import type { ApiResponse, RequestConfig, ApiError } from './types'

class ApiClient {
  private baseUrl: string
  private timeout: number
  private interceptors: InterceptorManager

  constructor() {
    this.baseUrl = getApiBaseUrl()
    this.timeout = API_CONFIG.TIMEOUT
    this.interceptors = new InterceptorManager()
  }

  /**
   * Get the interceptor manager for adding custom interceptors
   */
  getInterceptors(): InterceptorManager {
    return this.interceptors
  }

  /**
   * Update base URL (useful when switching between mock and real backend)
   */
  setBaseUrl(url: string): void {
    this.baseUrl = url
  }

  /**
   * Build full URL from endpoint
   */
  private buildUrl(endpoint: string, params?: Record<string, string | number | boolean | undefined>): string {
    const url = new URL(endpoint, this.baseUrl.startsWith('/') ? window.location.origin : undefined)

    // If baseUrl is relative (like /api), prepend it to the pathname
    if (this.baseUrl.startsWith('/')) {
      url.pathname = `${this.baseUrl}${endpoint}`
    }

    // Add query parameters
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          url.searchParams.set(key, String(value))
        }
      })
    }

    return this.baseUrl.startsWith('/') ? `${url.pathname}${url.search}` : url.toString()
  }

  /**
   * Make an HTTP request
   */
  private async request<T>(
    method: string,
    endpoint: string,
    data?: unknown,
    config?: RequestConfig
  ): Promise<T> {
    const url = this.buildUrl(endpoint, config?.params)

    // Build request config
    let requestConfig: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...config?.headers,
      },
      signal: config?.signal,
    }

    // Add body for non-GET requests
    if (data && method !== 'GET') {
      requestConfig.body = JSON.stringify(data)
    }

    // Run request interceptors
    requestConfig = await this.interceptors.runRequestInterceptors(requestConfig)

    // Create abort controller for timeout
    const timeoutId = setTimeout(() => {
      if (!config?.signal?.aborted) {
        const controller = new AbortController()
        controller.abort()
      }
    }, config?.timeout || this.timeout)

    try {
      const response = await fetch(url, requestConfig)
      clearTimeout(timeoutId)

      // Run response interceptors
      const processedResponse = await this.interceptors.runResponseInterceptors(response)

      // Handle non-OK responses
      if (!processedResponse.ok) {
        const errorData = await processedResponse.json().catch(() => ({}))
        const error = new Error(errorData.error || errorData.message || 'Request failed') as Error & { status?: number }
        error.status = processedResponse.status
        throw error
      }

      // Parse response
      const text = await processedResponse.text()
      if (!text) {
        return {} as T
      }

      try {
        const json = JSON.parse(text) as ApiResponse<T>
        // If the response has a data property, return it
        if ('data' in json) {
          return json.data as T
        }
        // Otherwise return the whole response
        return json as T
      } catch {
        throw new Error('Invalid JSON response from server')
      }
    } catch (error) {
      clearTimeout(timeoutId)

      // Run error interceptors
      if (error instanceof Error) {
        await this.interceptors.runErrorInterceptors(error as Error & { status?: number })
      }

      throw error
    }
  }

  /**
   * GET request
   */
  async get<T>(endpoint: string, config?: RequestConfig): Promise<T> {
    return this.request<T>('GET', endpoint, undefined, config)
  }

  /**
   * POST request
   */
  async post<T>(endpoint: string, data?: unknown, config?: RequestConfig): Promise<T> {
    return this.request<T>('POST', endpoint, data, config)
  }

  /**
   * PUT request
   */
  async put<T>(endpoint: string, data?: unknown, config?: RequestConfig): Promise<T> {
    return this.request<T>('PUT', endpoint, data, config)
  }

  /**
   * PATCH request
   */
  async patch<T>(endpoint: string, data?: unknown, config?: RequestConfig): Promise<T> {
    return this.request<T>('PATCH', endpoint, data, config)
  }

  /**
   * DELETE request
   */
  async delete<T>(endpoint: string, config?: RequestConfig): Promise<T> {
    return this.request<T>('DELETE', endpoint, undefined, config)
  }
}

// Singleton instance
export const apiClient = new ApiClient()

// Export types for convenience
export type { ApiResponse, RequestConfig, ApiError }
