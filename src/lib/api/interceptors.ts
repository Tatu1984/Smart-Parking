// API Interceptors
// Request and response interceptors for API client

import { ROUTES } from '@/config/routes.config'

export type RequestInterceptor = (config: RequestInit) => RequestInit | Promise<RequestInit>
export type ResponseInterceptor = (response: Response) => Response | Promise<Response>
export type ErrorInterceptor = (error: Error & { status?: number }) => void | Promise<void>

// Default request interceptors
export const defaultRequestInterceptors: RequestInterceptor[] = [
  // Add default headers
  (config) => {
    return {
      ...config,
      headers: {
        'Content-Type': 'application/json',
        ...config.headers,
      },
      credentials: 'include', // Include cookies for auth
    }
  },

  // Placeholder for future request interceptors
  (config) => config,
]

// Default response interceptors
export const defaultResponseInterceptors: ResponseInterceptor[] = [
  // Log response timing in development
  async (response) => {
    if (process.env.NODE_ENV === 'development') {
      const timing = response.headers.get('X-Response-Time')
      if (timing) {
        console.debug(`[API] ${response.url} - ${timing}`)
      }
    }
    return response
  },
]

// Default error interceptors
export const defaultErrorInterceptors: ErrorInterceptor[] = [
  // Handle authentication errors
  async (error) => {
    if (error.status === 401) {
      // Clear any local state
      if (typeof window !== 'undefined') {
        // Redirect to login
        const currentPath = window.location.pathname
        if (!currentPath.startsWith('/login')) {
          window.location.href = `${ROUTES.LOGIN}?from=${encodeURIComponent(currentPath)}`
        }
      }
    }
  },

  // Handle rate limiting
  async (error) => {
    if (error.status === 429) {
      console.warn('[API] Rate limited. Please slow down.')
      // Could implement retry logic here
    }
  },

  // Handle server errors
  async (error) => {
    if (error.status && error.status >= 500) {
      console.error('[API] Server error:', error.message)
      // Could report to error tracking service here
    }
  },
]

// Interceptor manager
export class InterceptorManager {
  private requestInterceptors: RequestInterceptor[] = []
  private responseInterceptors: ResponseInterceptor[] = []
  private errorInterceptors: ErrorInterceptor[] = []

  constructor() {
    // Initialize with defaults
    this.requestInterceptors = [...defaultRequestInterceptors]
    this.responseInterceptors = [...defaultResponseInterceptors]
    this.errorInterceptors = [...defaultErrorInterceptors]
  }

  addRequestInterceptor(interceptor: RequestInterceptor): () => void {
    this.requestInterceptors.push(interceptor)
    return () => {
      const index = this.requestInterceptors.indexOf(interceptor)
      if (index !== -1) {
        this.requestInterceptors.splice(index, 1)
      }
    }
  }

  addResponseInterceptor(interceptor: ResponseInterceptor): () => void {
    this.responseInterceptors.push(interceptor)
    return () => {
      const index = this.responseInterceptors.indexOf(interceptor)
      if (index !== -1) {
        this.responseInterceptors.splice(index, 1)
      }
    }
  }

  addErrorInterceptor(interceptor: ErrorInterceptor): () => void {
    this.errorInterceptors.push(interceptor)
    return () => {
      const index = this.errorInterceptors.indexOf(interceptor)
      if (index !== -1) {
        this.errorInterceptors.splice(index, 1)
      }
    }
  }

  async runRequestInterceptors(config: RequestInit): Promise<RequestInit> {
    let result = config
    for (const interceptor of this.requestInterceptors) {
      result = await interceptor(result)
    }
    return result
  }

  async runResponseInterceptors(response: Response): Promise<Response> {
    let result = response
    for (const interceptor of this.responseInterceptors) {
      result = await interceptor(result)
    }
    return result
  }

  async runErrorInterceptors(error: Error & { status?: number }): Promise<void> {
    for (const interceptor of this.errorInterceptors) {
      await interceptor(error)
    }
  }
}
