'use client'

import { logger } from '@/lib/logger'
import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
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
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Car,
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Crown,
  RefreshCw,
  Calendar,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

interface Vehicle {
  id: string
  licensePlate: string
  vehicleType: string
  make: string | null
  model: string | null
  color: string | null
  ownerName: string | null
  ownerPhone: string | null
  ownerEmail: string | null
  isBlacklisted: boolean
  isWhitelisted: boolean
  isVip: boolean
  membershipId: string | null
  visitCount: number
  lastVisitAt: string | null
  createdAt: string
}

const vehicleTypeIcons: Record<string, string> = {
  CAR: '🚗',
  SUV: '🚙',
  MOTORCYCLE: '🏍️',
  BUS: '🚌',
  TRUCK: '🚛',
  VAN: '🚐',
  BICYCLE: '🚲',
}

export default function VehiclesPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null)
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 })
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchVehicles = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...(search && { search }),
        ...(typeFilter !== 'all' && { vehicleType: typeFilter }),
      })
      const res = await fetch(`/api/vehicles?${params}`)
      const data = await res.json()
      if (data.success) {
        setVehicles(data.data || [])
        setPagination(prev => ({ ...prev, ...data.pagination }))
      }
    } catch (error) {
      logger.error('Failed to fetch vehicles:', error instanceof Error ? error : undefined)
      toast.error('Failed to load vehicles')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchVehicles()
  }, [pagination.page, typeFilter])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (pagination.page === 1) {
        fetchVehicles()
      } else {
        setPagination(prev => ({ ...prev, page: 1 }))
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  const handleCreateVehicle = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setCreating(true)
    const formData = new FormData(e.currentTarget)

    try {
      const res = await fetch('/api/vehicles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          licensePlate: formData.get('licensePlate'),
          vehicleType: formData.get('vehicleType'),
          make: formData.get('make') || undefined,
          model: formData.get('model') || undefined,
          color: formData.get('color') || undefined,
          ownerName: formData.get('ownerName') || undefined,
          ownerPhone: formData.get('ownerPhone') || undefined,
        }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success('Vehicle added successfully')
        setIsCreateOpen(false)
        fetchVehicles()
      } else {
        toast.error(data.error || 'Failed to add vehicle')
      }
    } catch (error) {
      toast.error('Failed to add vehicle')
    } finally {
      setCreating(false)
    }
  }

  const handleToggleStatus = async (vehicleId: string, field: 'isBlacklisted' | 'isWhitelisted' | 'isVip', value: boolean) => {
    try {
      const res = await fetch(`/api/vehicles/${vehicleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success('Vehicle updated')
        fetchVehicles()
        if (selectedVehicle?.id === vehicleId) {
          setSelectedVehicle({ ...selectedVehicle, [field]: value })
        }
      } else {
        toast.error(data.error || 'Failed to update vehicle')
      }
    } catch (error) {
      toast.error('Failed to update vehicle')
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    setDeleting(true)

    try {
      const res = await fetch(`/api/vehicles/${deleteId}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (data.success) {
        toast.success('Vehicle deleted')
        setSelectedVehicle(null)
        setDeleteId(null)
        fetchVehicles()
      } else {
        toast.error(data.error || 'Failed to delete vehicle')
      }
    } catch (error) {
      toast.error('Failed to delete vehicle')
    } finally {
      setDeleting(false)
    }
  }

  const stats = {
    total: pagination.total,
    vip: vehicles.filter(v => v.isVip).length,
    blacklisted: vehicles.filter(v => v.isBlacklisted).length,
    whitelisted: vehicles.filter(v => v.isWhitelisted).length,
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Vehicle Registry</h1>
          <p className="text-muted-foreground">
            Manage registered vehicles and access control
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={fetchVehicles} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
            Refresh
          </Button>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Add Vehicle
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Vehicle</DialogTitle>
                <DialogDescription>
                  Register a vehicle in the system
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateVehicle}>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="licensePlate">License Plate *</Label>
                    <Input id="licensePlate" name="licensePlate" placeholder="e.g., KA-01-AB-1234" required />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="vehicleType">Vehicle Type</Label>
                      <Select name="vehicleType" defaultValue="CAR">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="CAR">Car</SelectItem>
                          <SelectItem value="SUV">SUV</SelectItem>
                          <SelectItem value="MOTORCYCLE">Motorcycle</SelectItem>
                          <SelectItem value="BUS">Bus</SelectItem>
                          <SelectItem value="TRUCK">Truck</SelectItem>
                          <SelectItem value="VAN">Van</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="color">Color</Label>
                      <Input id="color" name="color" placeholder="e.g., White" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="make">Make</Label>
                      <Input id="make" name="make" placeholder="e.g., Toyota" />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="model">Model</Label>
                      <Input id="model" name="model" placeholder="e.g., Camry" />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="ownerName">Owner Name</Label>
                    <Input id="ownerName" name="ownerName" placeholder="Full name" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="ownerPhone">Owner Phone</Label>
                    <Input id="ownerPhone" name="ownerPhone" placeholder="+91 98765 43210" />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={creating}>
                    {creating ? 'Adding...' : 'Add Vehicle'}
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
              <Car className="h-6 w-6 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-sm text-muted-foreground">Total Vehicles</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-yellow-500/10">
              <Crown className="h-6 w-6 text-yellow-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.vip}</p>
              <p className="text-sm text-muted-foreground">VIP Members</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10">
              <ShieldCheck className="h-6 w-6 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.whitelisted}</p>
              <p className="text-sm text-muted-foreground">Whitelisted</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
              <ShieldAlert className="h-6 w-6 text-red-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.blacklisted}</p>
              <p className="text-sm text-muted-foreground">Blacklisted</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Vehicles</CardTitle>
          <CardDescription>View and manage registered vehicles</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
            <div className="flex flex-1 gap-4">
              <div className="relative flex-1 md:max-w-sm">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search license plates..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8"
                />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[150px]">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="CAR">Car</SelectItem>
                  <SelectItem value="SUV">SUV</SelectItem>
                  <SelectItem value="MOTORCYCLE">Motorcycle</SelectItem>
                  <SelectItem value="BUS">Bus</SelectItem>
                  <SelectItem value="TRUCK">Truck</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Visits</TableHead>
                  <TableHead>Last Visit</TableHead>
                  <TableHead>Status</TableHead>
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
                ) : vehicles.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No vehicles found
                    </TableCell>
                  </TableRow>
                ) : (
                  vehicles.map((vehicle) => (
                    <TableRow key={vehicle.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{vehicleTypeIcons[vehicle.vehicleType] || '🚗'}</span>
                          <div>
                            <span className="font-medium font-mono">{vehicle.licensePlate}</span>
                            <p className="text-xs text-muted-foreground">
                              {vehicle.make} {vehicle.model} {vehicle.color && `• ${vehicle.color}`}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {vehicle.ownerName ? (
                          <div>
                            <span>{vehicle.ownerName}</span>
                            {vehicle.ownerPhone && (
                              <p className="text-xs text-muted-foreground">{vehicle.ownerPhone}</p>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">N/A</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{vehicle.visitCount} visits</Badge>
                      </TableCell>
                      <TableCell>
                        {vehicle.lastVisitAt ? (
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3 text-muted-foreground" />
                            <span className="text-sm">
                              {new Date(vehicle.lastVisitAt).toLocaleDateString()}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Never</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {vehicle.isVip && (
                            <Badge className="bg-yellow-500">VIP</Badge>
                          )}
                          {vehicle.isWhitelisted && (
                            <Badge variant="secondary" className="bg-green-100 text-green-800">
                              Whitelisted
                            </Badge>
                          )}
                          {vehicle.isBlacklisted && (
                            <Badge variant="destructive">Blacklisted</Badge>
                          )}
                          {!vehicle.isVip && !vehicle.isWhitelisted && !vehicle.isBlacklisted && (
                            <Badge variant="outline">Regular</Badge>
                          )}
                        </div>
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
                            <DropdownMenuItem onClick={() => setSelectedVehicle(vehicle)}>
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleToggleStatus(vehicle.id, 'isVip', !vehicle.isVip)}>
                              <Crown className="mr-2 h-4 w-4" />
                              {vehicle.isVip ? 'Remove VIP' : 'Mark as VIP'}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleToggleStatus(vehicle.id, 'isWhitelisted', !vehicle.isWhitelisted)}>
                              <ShieldCheck className="mr-2 h-4 w-4" />
                              {vehicle.isWhitelisted ? 'Remove from Whitelist' : 'Add to Whitelist'}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleToggleStatus(vehicle.id, 'isBlacklisted', !vehicle.isBlacklisted)}>
                              <ShieldAlert className="mr-2 h-4 w-4" />
                              {vehicle.isBlacklisted ? 'Remove from Blacklist' : 'Add to Blacklist'}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => setDeleteId(vehicle.id)}
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
                  onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page === pagination.totalPages}
                  onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Vehicle Details Dialog */}
      <Dialog open={!!selectedVehicle} onOpenChange={() => setSelectedVehicle(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Vehicle Details</DialogTitle>
            <DialogDescription>
              {selectedVehicle?.licensePlate}
            </DialogDescription>
          </DialogHeader>
          {selectedVehicle && (
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
                <span className="text-4xl">{vehicleTypeIcons[selectedVehicle.vehicleType] || '🚗'}</span>
                <div>
                  <p className="font-bold text-lg">{selectedVehicle.licensePlate}</p>
                  <p className="text-muted-foreground">
                    {selectedVehicle.make} {selectedVehicle.model}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Type</Label>
                  <p className="font-medium">{selectedVehicle.vehicleType}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Color</Label>
                  <p className="font-medium">{selectedVehicle.color || 'N/A'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Owner</Label>
                  <p className="font-medium">{selectedVehicle.ownerName || 'N/A'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Phone</Label>
                  <p className="font-medium">{selectedVehicle.ownerPhone || 'N/A'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Total Visits</Label>
                  <p className="font-medium">{selectedVehicle.visitCount}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Last Visit</Label>
                  <p className="font-medium">
                    {selectedVehicle.lastVisitAt
                      ? new Date(selectedVehicle.lastVisitAt).toLocaleDateString()
                      : 'Never'}
                  </p>
                </div>
              </div>

              <div className="border-t pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Label>VIP Status</Label>
                  <Switch
                    checked={selectedVehicle.isVip}
                    onCheckedChange={(v) => handleToggleStatus(selectedVehicle.id, 'isVip', v)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Whitelisted</Label>
                  <Switch
                    checked={selectedVehicle.isWhitelisted}
                    onCheckedChange={(v) => handleToggleStatus(selectedVehicle.id, 'isWhitelisted', v)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Blacklisted</Label>
                  <Switch
                    checked={selectedVehicle.isBlacklisted}
                    onCheckedChange={(v) => handleToggleStatus(selectedVehicle.id, 'isBlacklisted', v)}
                  />
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Delete Vehicle"
        description="Are you sure you want to delete this vehicle? This action cannot be undone."
        confirmText="Delete"
        variant="destructive"
        onConfirm={handleDelete}
        loading={deleting}
      />
    </div>
  )
}
