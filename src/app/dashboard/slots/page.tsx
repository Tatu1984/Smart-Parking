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
import {
  ParkingSquare,
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  Trash2,
  Eye,
  Wrench,
  Car,
  Zap,
  Accessibility,
  RefreshCw,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

interface Slot {
  id: string
  slotNumber: string
  slotType: string
  vehicleType: string
  status: string
  isOccupied: boolean
  hasEvCharger: boolean
  isAccessible: boolean
  confidence: number
  lastDetectedAt: string | null
  zone: {
    id: string
    name: string
    code: string
    level: number
    parkingLot: {
      id: string
      name: string
    }
  }
  camera: {
    id: string
    name: string
    status: string
  } | null
}

interface Zone {
  id: string
  name: string
  code: string
}

const statusColors: Record<string, string> = {
  AVAILABLE: 'bg-green-500',
  OCCUPIED: 'bg-red-500',
  RESERVED: 'bg-yellow-500',
  MAINTENANCE: 'bg-gray-500',
  BLOCKED: 'bg-black',
}

const statusBadgeVariants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  AVAILABLE: 'default',
  OCCUPIED: 'destructive',
  RESERVED: 'secondary',
  MAINTENANCE: 'outline',
  BLOCKED: 'outline',
}

export default function SlotsPage() {
  const [slots, setSlots] = useState<Slot[]>([])
  const [zones, setZones] = useState<Zone[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [zoneFilter, setZoneFilter] = useState<string>('all')
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null)
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 })
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchZones = async () => {
    try {
      const res = await fetch('/api/zones?limit=100')
      const data = await res.json()
      if (data.success) {
        setZones(data.data || [])
      }
    } catch (error) {
      logger.error('Failed to fetch zones:', error instanceof Error ? error : undefined)
    }
  }

  const fetchSlots = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...(search && { search }),
        ...(statusFilter !== 'all' && { status: statusFilter }),
        ...(zoneFilter !== 'all' && { zoneId: zoneFilter }),
      })
      const res = await fetch(`/api/slots?${params}`)
      const data = await res.json()
      if (data.success) {
        setSlots(data.data || [])
        setPagination(prev => ({ ...prev, ...data.pagination }))
      }
    } catch (error) {
      logger.error('Failed to fetch slots:', error instanceof Error ? error : undefined)
      toast.error('Failed to load slots')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchZones()
  }, [])

  useEffect(() => {
    fetchSlots()
  }, [pagination.page, statusFilter, zoneFilter])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (pagination.page === 1) {
        fetchSlots()
      } else {
        setPagination(prev => ({ ...prev, page: 1 }))
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  const handleCreateSlots = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setCreating(true)
    const formData = new FormData(e.currentTarget)

    try {
      const res = await fetch('/api/slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          zoneId: formData.get('zoneId'),
          prefix: formData.get('prefix'),
          count: parseInt(formData.get('count') as string) || 1,
          startNumber: parseInt(formData.get('startNumber') as string) || 1,
          slotType: formData.get('slotType'),
          vehicleType: formData.get('vehicleType') || 'CAR',
        }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success(data.message || 'Slots created successfully')
        setIsCreateOpen(false)
        fetchSlots()
      } else {
        toast.error(data.error || 'Failed to create slots')
      }
    } catch (error) {
      toast.error('Failed to create slots')
    } finally {
      setCreating(false)
    }
  }

  const handleUpdateStatus = async (slotId: string, status: string) => {
    try {
      const res = await fetch(`/api/slots/${slotId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          isOccupied: status === 'OCCUPIED',
        }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success('Slot status updated')
        fetchSlots()
      } else {
        toast.error(data.error || 'Failed to update slot')
      }
    } catch (error) {
      toast.error('Failed to update slot')
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    setDeleting(true)

    try {
      const res = await fetch(`/api/slots/${deleteId}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (data.success) {
        toast.success('Slot deleted')
        setSelectedSlot(null)
        setDeleteId(null)
        fetchSlots()
      } else {
        toast.error(data.error || 'Failed to delete slot')
      }
    } catch (error) {
      toast.error('Failed to delete slot')
    } finally {
      setDeleting(false)
    }
  }

  const stats = {
    total: pagination.total,
    available: slots.filter(s => s.status === 'AVAILABLE').length,
    occupied: slots.filter(s => s.isOccupied).length,
    maintenance: slots.filter(s => s.status === 'MAINTENANCE').length,
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Slot Management</h1>
          <p className="text-muted-foreground">
            Configure and monitor parking slots across all zones
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={fetchSlots} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
            Refresh
          </Button>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Add Slots
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Slots</DialogTitle>
                <DialogDescription>
                  Create single or bulk slots for a zone
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateSlots}>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="zoneId">Zone *</Label>
                    <Select name="zoneId" required>
                      <SelectTrigger>
                        <SelectValue placeholder="Select zone" />
                      </SelectTrigger>
                      <SelectContent>
                        {zones.map((zone) => (
                          <SelectItem key={zone.id} value={zone.id}>
                            {zone.code} - {zone.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="prefix">Prefix *</Label>
                      <Input id="prefix" name="prefix" placeholder="A" required />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="startNumber">Start #</Label>
                      <Input id="startNumber" name="startNumber" type="number" defaultValue={1} min={1} />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="count">Count *</Label>
                      <Input id="count" name="count" type="number" placeholder="50" required min={1} max={200} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="slotType">Slot Type</Label>
                      <Select name="slotType" defaultValue="STANDARD">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="STANDARD">Standard</SelectItem>
                          <SelectItem value="COMPACT">Compact</SelectItem>
                          <SelectItem value="LARGE">Large</SelectItem>
                          <SelectItem value="HANDICAPPED">Handicapped</SelectItem>
                          <SelectItem value="EV_CHARGING">EV Charging</SelectItem>
                          <SelectItem value="MOTORCYCLE">Motorcycle</SelectItem>
                          <SelectItem value="VIP">VIP</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
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
                          <SelectItem value="VAN">Van</SelectItem>
                          <SelectItem value="BUS">Bus</SelectItem>
                          <SelectItem value="TRUCK">Truck</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={creating}>
                    {creating ? 'Creating...' : 'Create Slots'}
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
              <ParkingSquare className="h-6 w-6 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-sm text-muted-foreground">Total Slots</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10">
              <ParkingSquare className="h-6 w-6 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.available}</p>
              <p className="text-sm text-muted-foreground">Available</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
              <Car className="h-6 w-6 text-red-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.occupied}</p>
              <p className="text-sm text-muted-foreground">Occupied</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-yellow-500/10">
              <Wrench className="h-6 w-6 text-yellow-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.maintenance}</p>
              <p className="text-sm text-muted-foreground">Maintenance</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>All Slots</CardTitle>
          <CardDescription>
            View and manage all parking slots
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-1 gap-4">
              <div className="relative flex-1 md:max-w-sm">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search slots..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px]">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="AVAILABLE">Available</SelectItem>
                  <SelectItem value="OCCUPIED">Occupied</SelectItem>
                  <SelectItem value="RESERVED">Reserved</SelectItem>
                  <SelectItem value="MAINTENANCE">Maintenance</SelectItem>
                </SelectContent>
              </Select>
              <Select value={zoneFilter} onValueChange={setZoneFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Zone" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Zones</SelectItem>
                  {zones.map((zone) => (
                    <SelectItem key={zone.id} value={zone.id}>
                      {zone.code} - {zone.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Table */}
          <div className="mt-6 rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Slot</TableHead>
                  <TableHead>Zone</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Features</TableHead>
                  <TableHead>AI Confidence</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : slots.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No slots found
                    </TableCell>
                  </TableRow>
                ) : (
                  slots.map((slot) => (
                    <TableRow key={slot.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div
                            className={cn(
                              'h-3 w-3 rounded-full',
                              statusColors[slot.status]
                            )}
                          />
                          <span className="font-medium">{slot.slotNumber}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span>{slot.zone.code} - {slot.zone.name}</span>
                          <span className="text-xs text-muted-foreground">
                            Level {slot.zone.level}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{slot.slotType}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusBadgeVariants[slot.status]}>
                          {slot.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {slot.hasEvCharger && (
                            <Badge variant="secondary" className="gap-1">
                              <Zap className="h-3 w-3" />
                              EV
                            </Badge>
                          )}
                          {slot.isAccessible && (
                            <Badge variant="secondary" className="gap-1">
                              <Accessibility className="h-3 w-3" />
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {slot.confidence > 0 ? (
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className={cn(
                                  'h-full rounded-full',
                                  slot.confidence >= 0.9 ? 'bg-green-500' :
                                  slot.confidence >= 0.7 ? 'bg-yellow-500' : 'bg-red-500'
                                )}
                                style={{ width: `${slot.confidence * 100}%` }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {Math.round(slot.confidence * 100)}%
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
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
                            <DropdownMenuItem onClick={() => setSelectedSlot(slot)}>
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            {slot.status !== 'AVAILABLE' && (
                              <DropdownMenuItem onClick={() => handleUpdateStatus(slot.id, 'AVAILABLE')}>
                                <ParkingSquare className="mr-2 h-4 w-4" />
                                Mark Available
                              </DropdownMenuItem>
                            )}
                            {slot.status !== 'OCCUPIED' && (
                              <DropdownMenuItem onClick={() => handleUpdateStatus(slot.id, 'OCCUPIED')}>
                                <Car className="mr-2 h-4 w-4" />
                                Mark Occupied
                              </DropdownMenuItem>
                            )}
                            {slot.status !== 'MAINTENANCE' && (
                              <DropdownMenuItem onClick={() => handleUpdateStatus(slot.id, 'MAINTENANCE')}>
                                <Wrench className="mr-2 h-4 w-4" />
                                Mark Maintenance
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => setDeleteId(slot.id)}
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

      {/* Slot Details Dialog */}
      <Dialog open={!!selectedSlot} onOpenChange={() => setSelectedSlot(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Slot Details - {selectedSlot?.slotNumber}</DialogTitle>
            <DialogDescription>
              {selectedSlot?.zone.code} - {selectedSlot?.zone.name}
            </DialogDescription>
          </DialogHeader>
          {selectedSlot && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <div className={cn('h-3 w-3 rounded-full', statusColors[selectedSlot.status])} />
                    <span className="font-medium">{selectedSlot.status}</span>
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Occupied</Label>
                  <p className="font-medium">{selectedSlot.isOccupied ? 'Yes' : 'No'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Slot Type</Label>
                  <p className="font-medium">{selectedSlot.slotType}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Vehicle Type</Label>
                  <p className="font-medium">{selectedSlot.vehicleType}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Parking Lot</Label>
                  <p className="font-medium">{selectedSlot.zone.parkingLot.name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Level</Label>
                  <p className="font-medium">{selectedSlot.zone.level}</p>
                </div>
              </div>
              <div className="flex gap-2">
                {selectedSlot.hasEvCharger && <Badge>EV Charger</Badge>}
                {selectedSlot.isAccessible && <Badge>Accessible</Badge>}
              </div>
              {selectedSlot.camera && (
                <div>
                  <Label className="text-muted-foreground">Monitored By</Label>
                  <p className="font-medium">{selectedSlot.camera.name}</p>
                </div>
              )}
              {selectedSlot.lastDetectedAt && (
                <div>
                  <Label className="text-muted-foreground">Last Detection</Label>
                  <p className="font-medium">
                    {new Date(selectedSlot.lastDetectedAt).toLocaleString()}
                    {selectedSlot.confidence > 0 && (
                      <span className="text-muted-foreground ml-2">
                        ({Math.round(selectedSlot.confidence * 100)}% confidence)
                      </span>
                    )}
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Delete Slot"
        description="Are you sure you want to delete this slot? This action cannot be undone."
        confirmText="Delete"
        variant="destructive"
        onConfirm={handleDelete}
        loading={deleting}
      />
    </div>
  )
}
