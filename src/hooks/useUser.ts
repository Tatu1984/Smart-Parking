// useUser Hook
// Handles user profile and management operations

import { useState, useCallback } from 'react'
import { userService, UpdateProfileData, UserFilters } from '@/services/user.service'
import type { UserProfile, PaginatedResponse } from '@/lib/api/types'

interface UseUserReturn {
  user: UserProfile | null
  loading: boolean
  error: string | null
  fetchUser: () => Promise<void>
  updateProfile: (data: UpdateProfileData) => Promise<void>
}

export function useUser(): UseUserReturn {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchUser = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const userData = await userService.getCurrentUser()
      setUser(userData)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch user'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [])

  const updateProfile = useCallback(async (data: UpdateProfileData) => {
    try {
      setLoading(true)
      setError(null)
      const updatedUser = await userService.updateProfile(data)
      setUser(updatedUser)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update profile'
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  return {
    user,
    loading,
    error,
    fetchUser,
    updateProfile,
  }
}

// Hook for managing users (admin)
interface UseUsersReturn {
  users: PaginatedResponse<UserProfile> | null
  loading: boolean
  error: string | null
  fetchUsers: (filters?: UserFilters) => Promise<void>
  createUser: (data: Parameters<typeof userService.createUser>[0]) => Promise<UserProfile>
  updateUser: (id: string, data: Parameters<typeof userService.updateUser>[1]) => Promise<UserProfile>
  deleteUser: (id: string) => Promise<void>
}

export function useUsers(): UseUsersReturn {
  const [users, setUsers] = useState<PaginatedResponse<UserProfile> | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchUsers = useCallback(async (filters?: UserFilters) => {
    try {
      setLoading(true)
      setError(null)
      const data = await userService.listUsers(filters)
      setUsers(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch users'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [])

  const createUser = useCallback(async (data: Parameters<typeof userService.createUser>[0]) => {
    setLoading(true)
    try {
      const newUser = await userService.createUser(data)
      return newUser
    } finally {
      setLoading(false)
    }
  }, [])

  const updateUser = useCallback(async (id: string, data: Parameters<typeof userService.updateUser>[1]) => {
    setLoading(true)
    try {
      const updatedUser = await userService.updateUser(id, data)
      return updatedUser
    } finally {
      setLoading(false)
    }
  }, [])

  const deleteUser = useCallback(async (id: string) => {
    setLoading(true)
    try {
      await userService.deleteUser(id)
    } finally {
      setLoading(false)
    }
  }, [])

  return {
    users,
    loading,
    error,
    fetchUsers,
    createUser,
    updateUser,
    deleteUser,
  }
}
