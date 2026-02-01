// useAuth Hook
// Handles authentication state and operations

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { authService } from '@/services/auth.service'
import type { LoginRequest, UserProfile } from '@/lib/api/types'
import { ROUTES } from '@/config/routes.config'

interface UseAuthReturn {
  user: UserProfile | null
  loading: boolean
  error: string | null
  isAuthenticated: boolean
  login: (credentials: LoginRequest) => Promise<void>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  // Check authentication on mount
  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const userData = await authService.getCurrentUser()
      setUser(userData)
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  const login = useCallback(async (credentials: LoginRequest) => {
    try {
      setLoading(true)
      setError(null)
      const response = await authService.login(credentials)
      setUser(response.user as unknown as UserProfile)
      router.push(ROUTES.DASHBOARD)
      router.refresh()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed'
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [router])

  const logout = useCallback(async () => {
    try {
      setLoading(true)
      await authService.logout()
      setUser(null)
      router.push(ROUTES.LOGIN)
      router.refresh()
    } catch (err) {
      console.error('Logout error:', err)
      // Still clear user on error
      setUser(null)
      router.push(ROUTES.LOGIN)
    } finally {
      setLoading(false)
    }
  }, [router])

  const refreshUser = useCallback(async () => {
    await checkAuth()
  }, [checkAuth])

  return {
    user,
    loading,
    error,
    isAuthenticated: !!user,
    login,
    logout,
    refreshUser,
  }
}
