'use client'

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
import { Progress } from '@/components/ui/progress'
import {
  MapPin,
  Plus,
  Search,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  RefreshCw,
  ParkingSquare,
  Layers,
  Zap,
  Accessibility,
  Crown,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface Zone {
  id: string
  name: string
  code: string
  level: number
  zoneType: string
  description: string | null
  color: string
  sortOrder: number
  parkingLot: {
    id: string
    name: string
  }
  _count: {
    slots: number
  }
  slots: {
    isOccupied: boolean
  }[]
}

const zoneTypeConfig: Record<string, { icon: typeof MapPin; label: string; color: string }> = {
  GENERAL: { icon: MapPin, label: 'General', color: 'bg-blue-500' },
  VIP: { icon: Crown, label: 'VIP', color: 'bg-yellow-500' },
  EV_CHARGING: { icon: Zap, label: 'EV Charging', color: 'bg-green-500' },
  DISABLED: { icon: Accessibility, label: 'Accessible', color: 'bg-purple-500' },
  STAFF: { icon: MapPin, label: 'Staff', color: 'bg-gray-500' },
  VISITOR: { icon: MapPin, label: 'Visitor', color: 'bg-cyan-500' },
  SHORT_TERM: { icon: MapPin, label: 'Short Term', color: 'bg-orange-500' },
  LONG_TERM: { icon: MapPin, label: 'Long Term', color: 'bg-indigo-500' },
  TWO_WHEELER: { icon: MapPin, label: 'Two Wheeler', color: 'bg-pink-500' },
  VALET: { icon: MapPin, label: 'Valet', color: 'bg-red-500' },
  RESERVED: { icon: MapPin, label: 'Reserved', color: 'bg-amber-500' },
}

export default function ZonesPage() {
  const [zones, setZones] = useState<Zone[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [selectedZone, setSelectedZone] = useState<Zone | null>(null)
  const [editingZone, setEditingZone] = useState<Zone | null>(null)
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 })

  const fetchZones = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...(search && { search }),
        ...(typeFilter !== 'all' && { zoneType: typeFilter }),
      })
      const res = await fetch(`/api/zones?${params}`)
      const data = await res.json()
      if (data.success) {
        setZones(data.data || [])
        setPagination(prev => ({ ...prev, ...data.pagination }))
      }
    } catch (error) {
      console.error('Failed to fetch zones:', error)
      toast.error('Failed to load zones')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchZones()
  }, [pagination.page, typeFilter])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (pagination.page === 1) {
        fetchZones()
      } else {
        setPagination(prev => ({ ...prev, page: 1 }))
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  const handleCreateZone = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setCreating(true)
    const formData = new FormData(e.currentTarget)

    try {
      const res = await fetch('/api/zones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parkingLotId: formData.get('parkingLotId'),
          name: formData.get('name'),
          code: formData.get('code'),
          level: parseInt(formData.get('level') as string) || 0,
          zoneType: formData.get('zoneType'),
          description: formData.get('description') || undefined,
          color: formData.get('color') || '#3182CE',
        }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success('Zone created successfully')
        setIsCreateOpen(false)
        fetchZones()
      } else {
        toast.error(data.error || 'Failed to create zone')
      }
    } catch (error) {
      toast.error('Failed to create zone')
    } finally {
      setCreating(false)
    }
  }

  const handleUpdateZone = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!editingZone) return

    const formData = new FormData(e.currentTarget)

    try {
      const res = await fetch(`/api/zones/${editingZone.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.get('name'),
          code: formData.get('code'),
          level: parseInt(formData.get('level') as string) || 0,
          zoneType: formData.get('zoneType'),
          description: formData.get('description') || undefined,
          color: formData.get('color'),
        }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success('Zone updated successfully')
        setEditingZone(null)
        fetchZones()
      } else {
        toast.error(data.error || 'Failed to update zone')
      }
    } catch (error) {
      toast.error('Failed to update zone')
    }
  }

  const handleDelete = async (zoneId: string) => {
    if (!confirm('Are you sure you want to delete this zone? All slots in this zone will also be deleted.')) return

    try {
      const res = await fetch(`/api/zones/${zoneId}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (data.success) {
        toast.success('Zone deleted')
        setSelectedZone(null)
        fetchZones()
      } else {
        toast.error(data.error || 'Failed to delete zone')
      }
    } catch (error) {
      toast.error('Failed to delete zone')
    }
  }

  const getOccupancyStats = (zone: Zone) => {
    const total = zone._count.slots
    const occupied = zone.slots.filter(s => s.isOccupied).length
    const available = total - occupied
    const rate = total > 0 ? Math.round((occupied / total) * 100) : 0
    return { total, occupied, available, rate }
  }

  // Calculate overall stats
  const totalSlots = zones.reduce((acc, z) => acc + z._count.slots, 0)
  const totalOccupied = zones.reduce((acc, z) => acc + z.slots.filter(s => s.isOccupied).length, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Zone Management</h1>
          <p className="text-muted-foreground">
            Organize and configure parking zones
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={fetchZones} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
            Refresh
          </Button>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                New Zone
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Zone</DialogTitle>
                <DialogDescription>
                  Add a new parking zone to the facility
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateZone}>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="parkingLotId">Parking Lot ID *</Label>
                    <Input id="parkingLotId" name="parkingLotId" placeholder="Enter parking lot ID" required />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="name">Zone Name *</Label>
                      <Input id="name" name="name" placeholder="e.g., Ground Floor A" required />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="code">Zone Code *</Label>
                      <Input id="code" name="code" placeholder="e.g., GF-A" required />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="level">Floor Level</Label>
                      <Input id="level" name="level" type="number" defaultValue={0} />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="zoneType">Zone Type</Label>
                      <Select name="zoneType" defaultValue="GENERAL">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="GENERAL">General</SelectItem>
                          <SelectItem value="VIP">VIP</SelectItem>
                          <SelectItem value="EV_CHARGING">EV Charging</SelectItem>
                          <SelectItem value="DISABLED">Accessible</SelectItem>
                          <SelectItem value="STAFF">Staff</SelectItem>
                          <SelectItem value="VISITOR">Visitor</SelectItem>
                          <SelectItem value="SHORT_TERM">Short Term</SelectItem>
                          <SelectItem value="LONG_TERM">Long Term</SelectItem>
                          <SelectItem value="TWO_WHEELER">Two Wheeler</SelectItem>
                          <SelectItem value="VALET">Valet</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="color">Color</Label>
                    <div className="flex gap-2">
                      <Input id="color" name="color" type="color" defaultValue="#3182CE" className="w-14 h-10 p-1" />
                      <Input defaultValue="#3182CE" className="flex-1" disabled />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="description">Description</Label>
                    <Input id="description" name="description" placeholder="Optional description" />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={creating}>
                    {creating ? 'Creating...' : 'Create Zone'}
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
              <Layers className="h-6 w-6 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{zones.length}</p>
              <p className="text-sm text-muted-foreground">Total Zones</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10">
              <ParkingSquare className="h-6 w-6 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalSlots}</p>
              <p className="text-sm text-muted-foreground">Total Slots</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-500/10">
              <MapPin className="h-6 w-6 text-orange-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalOccupied}</p>
              <p className="text-sm text-muted-foreground">Occupied</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-500/10">
              <ParkingSquare className="h-6 w-6 text-purple-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalSlots - totalOccupied}</p>
              <p className="text-sm text-muted-foreground">Available</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Zone Cards Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-2">
                <div className="h-6 bg-muted rounded w-1/2" />
              </CardHeader>
              <CardContent>
                <div className="h-4 bg-muted rounded w-3/4 mb-4" />
                <div className="h-2 bg-muted rounded w-full" />
              </CardContent>
            </Card>
          ))
        ) : zones.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Layers className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium">No zones found</p>
              <p className="text-muted-foreground">Create your first zone to get started</p>
            </CardContent>
          </Card>
        ) : (
          zones.map((zone) => {
            const stats = getOccupancyStats(zone)
            const config = zoneTypeConfig[zone.zoneType] || zoneTypeConfig.GENERAL

            return (
              <Card key={zone.id} className="relative overflow-hidden">
                <div
                  className="absolute top-0 left-0 w-1 h-full"
                  style={{ backgroundColor: zone.color }}
                />
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge
                        style={{ backgroundColor: zone.color }}
                        className="text-white"
                      >
                        {zone.code}
                      </Badge>
                      <Badge variant="outline">{config.label}</Badge>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setSelectedZone(zone)}>
                          <Eye className="mr-2 h-4 w-4" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setEditingZone(zone)}>
                          <Edit className="mr-2 h-4 w-4" />
                          Edit Zone
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => handleDelete(zone.id)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <CardTitle className="text-lg">{zone.name}</CardTitle>
                  <CardDescription>
                    Level {zone.level} • {zone.parkingLot.name}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Occupancy</span>
                      <span className="font-medium">
                        {stats.occupied}/{stats.total} slots ({stats.rate}%)
                      </span>
                    </div>
                    <Progress value={stats.rate} className="h-2" />
                    <div className="flex gap-4 text-sm">
                      <div className="flex items-center gap-1">
                        <div className="h-2 w-2 rounded-full bg-green-500" />
                        <span>{stats.available} available</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="h-2 w-2 rounded-full bg-red-500" />
                        <span>{stats.occupied} occupied</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
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

      {/* Edit Zone Dialog */}
      <Dialog open={!!editingZone} onOpenChange={() => setEditingZone(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Zone</DialogTitle>
            <DialogDescription>
              Update zone configuration
            </DialogDescription>
          </DialogHeader>
          {editingZone && (
            <form onSubmit={handleUpdateZone}>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="edit-name">Zone Name</Label>
                    <Input id="edit-name" name="name" defaultValue={editingZone.name} required />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-code">Zone Code</Label>
                    <Input id="edit-code" name="code" defaultValue={editingZone.code} required />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="edit-level">Floor Level</Label>
                    <Input id="edit-level" name="level" type="number" defaultValue={editingZone.level} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-zoneType">Zone Type</Label>
                    <Select name="zoneType" defaultValue={editingZone.zoneType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="GENERAL">General</SelectItem>
                        <SelectItem value="VIP">VIP</SelectItem>
                        <SelectItem value="EV_CHARGING">EV Charging</SelectItem>
                        <SelectItem value="DISABLED">Accessible</SelectItem>
                        <SelectItem value="STAFF">Staff</SelectItem>
                        <SelectItem value="VISITOR">Visitor</SelectItem>
                        <SelectItem value="SHORT_TERM">Short Term</SelectItem>
                        <SelectItem value="LONG_TERM">Long Term</SelectItem>
                        <SelectItem value="TWO_WHEELER">Two Wheeler</SelectItem>
                        <SelectItem value="VALET">Valet</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-color">Color</Label>
                  <div className="flex gap-2">
                    <Input id="edit-color" name="color" type="color" defaultValue={editingZone.color} className="w-14 h-10 p-1" />
                    <Input defaultValue={editingZone.color} className="flex-1" disabled />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-description">Description</Label>
                  <Input id="edit-description" name="description" defaultValue={editingZone.description || ''} />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditingZone(null)}>
                  Cancel
                </Button>
                <Button type="submit">Save Changes</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Zone Details Dialog */}
      <Dialog open={!!selectedZone} onOpenChange={() => setSelectedZone(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedZone?.name}</DialogTitle>
            <DialogDescription>Zone details and statistics</DialogDescription>
          </DialogHeader>
          {selectedZone && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Zone Code</Label>
                  <p className="font-medium">{selectedZone.code}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Level</Label>
                  <p className="font-medium">{selectedZone.level}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Type</Label>
                  <p className="font-medium">{zoneTypeConfig[selectedZone.zoneType]?.label || selectedZone.zoneType}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Parking Lot</Label>
                  <p className="font-medium">{selectedZone.parkingLot.name}</p>
                </div>
              </div>
              {selectedZone.description && (
                <div>
                  <Label className="text-muted-foreground">Description</Label>
                  <p className="font-medium">{selectedZone.description}</p>
                </div>
              )}
              <div className="border-t pt-4">
                <Label className="text-muted-foreground">Slot Occupancy</Label>
                <div className="mt-2">
                  <Progress value={getOccupancyStats(selectedZone).rate} className="h-3" />
                  <div className="flex justify-between mt-2 text-sm">
                    <span>{getOccupancyStats(selectedZone).available} available</span>
                    <span>{getOccupancyStats(selectedZone).occupied} occupied</span>
                    <span>{getOccupancyStats(selectedZone).total} total</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
