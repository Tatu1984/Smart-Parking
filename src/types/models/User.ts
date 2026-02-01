// User Model Types
// Domain model for User entity

export interface User {
  id: string
  email: string
  name: string
  phone?: string | null
  avatar?: string | null
  role: UserRole
  status: UserStatus
  organizationId: string
  authProvider: AuthProvider
  providerUserId?: string | null
  createdAt: Date | string
  updatedAt: Date | string
}

export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'OPERATOR' | 'AUDITOR' | 'VIEWER'

export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED'

export type AuthProvider = 'LOCAL' | 'MICROSOFT'

export interface UserWithOrganization extends User {
  organization: {
    id: string
    name: string
    slug: string
  }
}

export interface UserWithAssignments extends UserWithOrganization {
  assignedLots: Array<{
    id: string
    name: string
    slug: string
  }>
}

// User creation/update DTOs
export interface CreateUserInput {
  email: string
  name: string
  password: string
  role: UserRole
  organizationId: string
  phone?: string
}

export interface UpdateUserInput {
  name?: string
  phone?: string
  avatar?: string
  role?: UserRole
  status?: UserStatus
}
