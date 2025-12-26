'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Users,
  Plus,
  Search,
  MoreHorizontal,
  Edit,
  Trash2,
  Shield,
  ShieldCheck,
  ShieldX,
  UserCheck,
  UserX,
  RefreshCw,
  Eye,
  Mail,
  Phone,
  Calendar,
  Clock,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface User {
  id: string
  email: string
  name: string
  phone: string | null
  avatar: string | null
  role: string
  status: string
  createdAt: string
  updatedAt: string
  lastLoginAt: string | null
  organization: {
    id: string
    name: string
  }
  assignedLots: Array<{
    parkingLot: {
      id: string
      name: string
    }
  }>
}

const roleColors: Record<string, string> = {
  SUPER_ADMIN: 'bg-purple-500',
  ADMIN: 'bg-blue-500',
  OPERATOR: 'bg-green-500',
  AUDITOR: 'bg-yellow-500',
  VIEWER: 'bg-gray-500',
}

const statusBadgeVariants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  ACTIVE: 'default',
  INACTIVE: 'secondary',
  SUSPENDED: 'destructive',
}

const roleLabels: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  OPERATOR: 'Operator',
  AUDITOR: 'Auditor',
  VIEWER: 'Viewer',
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isViewOpen, setIsViewOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 })

  const [formData, setFormData] = useState({
    email: '',
    name: '',
    phone: '',
    password: '',
    role: 'OPERATOR',
    status: 'ACTIVE',
  })

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...(search && { search }),
        ...(roleFilter !== 'all' && { role: roleFilter }),
        ...(statusFilter !== 'all' && { status: statusFilter }),
      })
      const res = await fetch(`/api/users?${params}`)
      const data = await res.json()
      if (data.success) {
        setUsers(data.data || [])
        setPagination(prev => ({ ...prev, ...data.pagination }))
      }
    } catch (error) {
      console.error('Failed to fetch users:', error)
      toast.error('Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [pagination.page, roleFilter, statusFilter])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (pagination.page === 1) {
        fetchUsers()
      } else {
        setPagination(prev => ({ ...prev, page: 1 }))
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          organizationId: users[0]?.organization?.id || 'default-org',
        }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success('User created successfully')
        setIsCreateOpen(false)
        resetForm()
        fetchUsers()
      } else {
        toast.error(data.error || 'Failed to create user')
      }
    } catch (error) {
      toast.error('Failed to create user')
    } finally {
      setSubmitting(false)
    }
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedUser) return
    setSubmitting(true)

    try {
      const updateData: any = {
        name: formData.name,
        email: formData.email,
        phone: formData.phone || null,
        role: formData.role,
        status: formData.status,
      }
      if (formData.password) {
        updateData.password = formData.password
      }

      const res = await fetch(`/api/users/${selectedUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      })
      const data = await res.json()
      if (data.success) {
        toast.success('User updated successfully')
        setIsEditOpen(false)
        resetForm()
        setSelectedUser(null)
        fetchUsers()
      } else {
        toast.error(data.error || 'Failed to update user')
      }
    } catch (error) {
      toast.error('Failed to update user')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return

    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (data.success) {
        toast.success('User deleted successfully')
        fetchUsers()
      } else {
        toast.error(data.error || 'Failed to delete user')
      }
    } catch (error) {
      toast.error('Failed to delete user')
    }
  }

  const handleStatusChange = async (userId: string, status: string) => {
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success(`User ${status.toLowerCase()}`)
        fetchUsers()
      } else {
        toast.error(data.error || 'Failed to update user status')
      }
    } catch (error) {
      toast.error('Failed to update user status')
    }
  }

  const resetForm = () => {
    setFormData({
      email: '',
      name: '',
      phone: '',
      password: '',
      role: 'OPERATOR',
      status: 'ACTIVE',
    })
  }

  const openEditDialog = (user: User) => {
    setSelectedUser(user)
    setFormData({
      email: user.email,
      name: user.name,
      phone: user.phone || '',
      password: '',
      role: user.role,
      status: user.status,
    })
    setIsEditOpen(true)
  }

  const openViewDialog = (user: User) => {
    setSelectedUser(user)
    setIsViewOpen(true)
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const stats = {
    total: pagination.total,
    active: users.filter((u) => u.status === 'ACTIVE').length,
    admins: users.filter((u) => u.role === 'ADMIN' || u.role === 'SUPER_ADMIN').length,
    suspended: users.filter((u) => u.status === 'SUSPENDED').length,
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
          <p className="text-muted-foreground">Manage system users and permissions</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={fetchUsers} disabled={loading}>
            <RefreshCw className={cn('h-4 w-4 mr-2', loading && 'animate-spin')} />
            Refresh
          </Button>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2" onClick={resetForm}>
                <Plus className="h-4 w-4" />
                Add User
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New User</DialogTitle>
                <DialogDescription>Add a new user to the system</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreate}>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="name">Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="password">Password *</Label>
                    <Input
                      id="password"
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      required
                      minLength={8}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="phone">Phone</Label>
                      <Input
                        id="phone"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="role">Role *</Label>
                      <Select
                        value={formData.role}
                        onValueChange={(value) => setFormData({ ...formData, role: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="VIEWER">Viewer</SelectItem>
                          <SelectItem value="OPERATOR">Operator</SelectItem>
                          <SelectItem value="AUDITOR">Auditor</SelectItem>
                          <SelectItem value="ADMIN">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={submitting}>
                    {submitting ? 'Creating...' : 'Create User'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/10">
              <Users className="h-6 w-6 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-sm text-muted-foreground">Total Users</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10">
              <UserCheck className="h-6 w-6 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.active}</p>
              <p className="text-sm text-muted-foreground">Active Users</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-500/10">
              <ShieldCheck className="h-6 w-6 text-purple-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.admins}</p>
              <p className="text-sm text-muted-foreground">Administrators</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
              <UserX className="h-6 w-6 text-red-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.suspended}</p>
              <p className="text-sm text-muted-foreground">Suspended</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
          <CardDescription>Manage user accounts and permissions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-1 gap-4">
              <div className="relative flex-1 md:max-w-sm">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8"
                />
              </div>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-[150px]">
                  <Shield className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                  <SelectItem value="OPERATOR">Operator</SelectItem>
                  <SelectItem value="AUDITOR">Auditor</SelectItem>
                  <SelectItem value="VIEWER">Viewer</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="INACTIVE">Inactive</SelectItem>
                  <SelectItem value="SUSPENDED">Suspended</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Table */}
          <div className="mt-6 rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Assigned Lots</TableHead>
                  <TableHead>Last Login</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No users found
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarImage src={user.avatar || undefined} />
                            <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{user.name}</p>
                            <p className="text-sm text-muted-foreground">{user.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className={cn('h-2 w-2 rounded-full', roleColors[user.role])} />
                          <span>{roleLabels[user.role]}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusBadgeVariants[user.status]}>{user.status}</Badge>
                      </TableCell>
                      <TableCell>
                        {user.assignedLots.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {user.assignedLots.slice(0, 2).map((lot) => (
                              <Badge key={lot.parkingLot.id} variant="outline">
                                {lot.parkingLot.name}
                              </Badge>
                            ))}
                            {user.assignedLots.length > 2 && (
                              <Badge variant="secondary">+{user.assignedLots.length - 2}</Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {user.lastLoginAt ? (
                          <span className="text-sm text-muted-foreground">
                            {new Date(user.lastLoginAt).toLocaleDateString()}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">Never</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => openViewDialog(user)}>
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openEditDialog(user)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {user.status !== 'ACTIVE' && (
                              <DropdownMenuItem onClick={() => handleStatusChange(user.id, 'ACTIVE')}>
                                <UserCheck className="mr-2 h-4 w-4" />
                                Activate
                              </DropdownMenuItem>
                            )}
                            {user.status !== 'SUSPENDED' && (
                              <DropdownMenuItem onClick={() => handleStatusChange(user.id, 'SUSPENDED')}>
                                <ShieldX className="mr-2 h-4 w-4" />
                                Suspend
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => handleDelete(user.id)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
                {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page === 1}
                  onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page === pagination.totalPages}
                  onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit User Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>Update user information</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdate}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-name">Name *</Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-email">Email *</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-password">New Password (leave blank to keep current)</Label>
                <Input
                  id="edit-password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  minLength={8}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit-phone">Phone</Label>
                  <Input
                    id="edit-phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-role">Role *</Label>
                  <Select
                    value={formData.role}
                    onValueChange={(value) => setFormData({ ...formData, role: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="VIEWER">Viewer</SelectItem>
                      <SelectItem value="OPERATOR">Operator</SelectItem>
                      <SelectItem value="AUDITOR">Auditor</SelectItem>
                      <SelectItem value="ADMIN">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData({ ...formData, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="INACTIVE">Inactive</SelectItem>
                    <SelectItem value="SUSPENDED">Suspended</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* View User Dialog */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>User Details</DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={selectedUser.avatar || undefined} />
                  <AvatarFallback className="text-xl">{getInitials(selectedUser.name)}</AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-xl font-semibold">{selectedUser.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <div className={cn('h-2 w-2 rounded-full', roleColors[selectedUser.role])} />
                    <span className="text-muted-foreground">{roleLabels[selectedUser.role]}</span>
                    <Badge variant={statusBadgeVariants[selectedUser.status]}>{selectedUser.status}</Badge>
                  </div>
                </div>
              </div>

              <div className="grid gap-4">
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span>{selectedUser.email}</span>
                </div>
                {selectedUser.phone && (
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedUser.phone}</span>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>Created {new Date(selectedUser.createdAt).toLocaleDateString()}</span>
                </div>
                {selectedUser.lastLoginAt && (
                  <div className="flex items-center gap-3">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>Last login {new Date(selectedUser.lastLoginAt).toLocaleString()}</span>
                  </div>
                )}
              </div>

              {selectedUser.assignedLots.length > 0 && (
                <div>
                  <Label className="text-muted-foreground">Assigned Parking Lots</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {selectedUser.assignedLots.map((lot) => (
                      <Badge key={lot.parkingLot.id} variant="outline">
                        {lot.parkingLot.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
