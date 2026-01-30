'use client'

import { logger } from '@/lib/logger'
import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Building2,
  Plus,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  RefreshCw,
  MapPin,
  Car,
  Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

interface ParkingLot {
  id: string
  name: string
  slug: string
  venueType: string
  address: string | null
  city: string | null
  state: string | null
  country: string
  currency: string
  status: string
  totalSlots: number
  occupiedSlots: number
  availableSlots: number
  occupancyRate: number
  hasEvCharging: boolean
  hasValetService: boolean
  hasMultiLevel: boolean
  _count: {
    zones: number
    cameras: number
  }
}

const venueTypes = [
  { value: 'MALL', label: 'Shopping Mall' },
  { value: 'AIRPORT', label: 'Airport' },
  { value: 'HOSPITAL', label: 'Hospital' },
  { value: 'HOTEL', label: 'Hotel' },
  { value: 'COMMERCIAL', label: 'Commercial Building' },
  { value: 'STADIUM', label: 'Stadium' },
  { value: 'CINEMA', label: 'Cinema' },
  { value: 'RESIDENTIAL', label: 'Residential' },
  { value: 'OTHER', label: 'Other' },
]

export default function ParkingLotsPage() {
  const [parkingLots, setParkingLots] = useState<ParkingLot[]>([])
  const [loading, setLoading] = useState(true)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [selectedLot, setSelectedLot] = useState<ParkingLot | null>(null)
  const [isViewOpen, setIsViewOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchParkingLots = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/parking-lots?limit=50')
      const data = await res.json()
      if (data.success) {
        setParkingLots(data.data || [])
      }
    } catch (error) {
      logger.error('Failed to fetch parking lots:', error instanceof Error ? error : undefined)
      toast.error('Failed to load parking lots')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchParkingLots()
  }, [])

  const handleCreateParkingLot = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setCreating(true)
    const formData = new FormData(e.currentTarget)

    try {
      const res = await fetch('/api/parking-lots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.get('name'),
          slug: formData.get('slug'),
          venueType: formData.get('venueType'),
          address: formData.get('address') || undefined,
          city: formData.get('city') || undefined,
          state: formData.get('state') || undefined,
          country: formData.get('country') || 'India',
          currency: formData.get('currency') || 'INR',
          hasEvCharging: formData.get('hasEvCharging') === 'on',
          hasValetService: formData.get('hasValetService') === 'on',
          hasMultiLevel: formData.get('hasMultiLevel') === 'on',
        }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success('Parking lot created successfully')
        setIsCreateOpen(false)
        fetchParkingLots()
      } else {
        toast.error(data.error || 'Failed to create parking lot')
      }
    } catch (error) {
      toast.error('Failed to create parking lot')
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    setDeleting(true)

    try {
      const res = await fetch(`/api/parking-lots/${deleteId}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (data.success) {
        toast.success('Parking lot deleted')
        setDeleteId(null)
        fetchParkingLots()
      } else {
        toast.error(data.error || 'Failed to delete parking lot')
      }
    } catch (error) {
      toast.error('Failed to delete parking lot')
    } finally {
      setDeleting(false)
    }
  }

  const handleUpdateParkingLot = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!selectedLot) return
    setUpdating(true)
    const formData = new FormData(e.currentTarget)

    try {
      const res = await fetch(`/api/parking-lots/${selectedLot.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.get('name'),
          venueType: formData.get('venueType'),
          address: formData.get('address') || undefined,
          city: formData.get('city') || undefined,
          state: formData.get('state') || undefined,
          country: formData.get('country') || 'India',
          currency: formData.get('currency') || 'INR',
          status: formData.get('status'),
          hasEvCharging: formData.get('hasEvCharging') === 'on',
          hasValetService: formData.get('hasValetService') === 'on',
          hasMultiLevel: formData.get('hasMultiLevel') === 'on',
        }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success('Parking lot updated successfully')
        setIsEditOpen(false)
        setSelectedLot(null)
        fetchParkingLots()
      } else {
        toast.error(data.error || 'Failed to update parking lot')
      }
    } catch (error) {
      toast.error('Failed to update parking lot')
    } finally {
      setUpdating(false)
    }
  }

  const openViewDialog = (lot: ParkingLot) => {
    setSelectedLot(lot)
    setIsViewOpen(true)
  }

  const openEditDialog = (lot: ParkingLot) => {
    setSelectedLot(lot)
    setIsEditOpen(true)
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      ACTIVE: 'default',
      MAINTENANCE: 'secondary',
      CLOSED: 'destructive',
    }
    return <Badge variant={variants[status] || 'outline'}>{status}</Badge>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Parking Lots</h1>
          <p className="text-muted-foreground">
            Manage your parking facilities
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={fetchParkingLots} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
            Refresh
          </Button>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                New Parking Lot
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Create New Parking Lot</DialogTitle>
                <DialogDescription>
                  Add a new parking facility to your organization
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateParkingLot}>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="name">Name *</Label>
                      <Input id="name" name="name" placeholder="e.g., City Mall Parking" required />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="slug">Slug *</Label>
                      <Input id="slug" name="slug" placeholder="e.g., city-mall-parking" required />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="venueType">Venue Type *</Label>
                      <Select name="venueType" defaultValue="MALL">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {venueTypes.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="currency">Currency</Label>
                      <Select name="currency" defaultValue="INR">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="INR">INR (₹)</SelectItem>
                          <SelectItem value="USD">USD ($)</SelectItem>
                          <SelectItem value="EUR">EUR (€)</SelectItem>
                          <SelectItem value="GBP">GBP (£)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="address">Address</Label>
                    <Input id="address" name="address" placeholder="Street address" />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="city">City</Label>
                      <Input id="city" name="city" placeholder="City" />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="state">State</Label>
                      <Input id="state" name="state" placeholder="State" />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="country">Country</Label>
                      <Input id="country" name="country" defaultValue="India" />
                    </div>
                  </div>
                  <div className="flex gap-6">
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" name="hasEvCharging" className="rounded" />
                      EV Charging
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" name="hasValetService" className="rounded" />
                      Valet Service
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" name="hasMultiLevel" className="rounded" />
                      Multi-Level
                    </label>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={creating}>
                    {creating ? 'Creating...' : 'Create Parking Lot'}
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
              <Building2 className="h-6 w-6 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{parkingLots.length}</p>
              <p className="text-sm text-muted-foreground">Total Facilities</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10">
              <Car className="h-6 w-6 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{parkingLots.reduce((sum, lot) => sum + lot.totalSlots, 0)}</p>
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
              <p className="text-2xl font-bold">{parkingLots.reduce((sum, lot) => sum + lot._count.zones, 0)}</p>
              <p className="text-sm text-muted-foreground">Total Zones</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-500/10">
              <Zap className="h-6 w-6 text-purple-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{parkingLots.filter(lot => lot.hasEvCharging).length}</p>
              <p className="text-sm text-muted-foreground">EV Enabled</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Parking Lots</CardTitle>
          <CardDescription>
            Manage and configure your parking facilities
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Zones</TableHead>
                  <TableHead>Slots</TableHead>
                  <TableHead>Occupancy</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[70px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : parkingLots.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No parking lots found. Create your first one!
                    </TableCell>
                  </TableRow>
                ) : (
                  parkingLots.map((lot) => (
                    <TableRow key={lot.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{lot.name}</p>
                          <p className="text-xs text-muted-foreground">{lot.slug}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{lot.venueType}</Badge>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm">{lot.city || '-'}</p>
                        <p className="text-xs text-muted-foreground">{lot.country}</p>
                      </TableCell>
                      <TableCell>{lot._count.zones}</TableCell>
                      <TableCell>
                        <p>{lot.availableSlots}/{lot.totalSlots}</p>
                        <p className="text-xs text-muted-foreground">available</p>
                      </TableCell>
                      <TableCell>
                        <p className="font-medium">{Math.round(lot.occupancyRate)}%</p>
                      </TableCell>
                      <TableCell>{getStatusBadge(lot.status)}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => openViewDialog(lot)}>
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openEditDialog(lot)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => setDeleteId(lot.id)}
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
        </CardContent>
      </Card>

      {/* View Details Dialog */}
      <Dialog open={isViewOpen} onOpenChange={(open) => { setIsViewOpen(open); if (!open) setSelectedLot(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Parking Lot Details</DialogTitle>
            <DialogDescription>
              Detailed information about {selectedLot?.name}
            </DialogDescription>
          </DialogHeader>
          {selectedLot && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Name</Label>
                  <p className="font-medium">{selectedLot.name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Slug</Label>
                  <p className="font-medium">{selectedLot.slug}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Venue Type</Label>
                  <p className="font-medium">{selectedLot.venueType}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <div className="mt-1">{getStatusBadge(selectedLot.status)}</div>
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground">Location</Label>
                <p className="font-medium">
                  {selectedLot.address || '-'}, {selectedLot.city || '-'}, {selectedLot.state || '-'}, {selectedLot.country}
                </p>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label className="text-muted-foreground">Total Slots</Label>
                  <p className="font-medium">{selectedLot.totalSlots}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Occupied</Label>
                  <p className="font-medium">{selectedLot.occupiedSlots}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Available</Label>
                  <p className="font-medium">{selectedLot.availableSlots}</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label className="text-muted-foreground">Zones</Label>
                  <p className="font-medium">{selectedLot._count.zones}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Cameras</Label>
                  <p className="font-medium">{selectedLot._count.cameras}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Occupancy</Label>
                  <p className="font-medium">{Math.round(selectedLot.occupancyRate)}%</p>
                </div>
              </div>
              <div className="flex gap-4">
                {selectedLot.hasEvCharging && <Badge variant="outline"><Zap className="mr-1 h-3 w-3" />EV Charging</Badge>}
                {selectedLot.hasValetService && <Badge variant="outline">Valet Service</Badge>}
                {selectedLot.hasMultiLevel && <Badge variant="outline">Multi-Level</Badge>}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewOpen(false)}>Close</Button>
            <Button onClick={() => { setIsViewOpen(false); if (selectedLot) openEditDialog(selectedLot); }}>Edit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Delete Parking Lot"
        description="Are you sure you want to delete this parking lot? All zones and slots will also be deleted. This action cannot be undone."
        confirmText="Delete"
        variant="destructive"
        onConfirm={handleDelete}
        loading={deleting}
      />

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={(open) => { setIsEditOpen(open); if (!open) setSelectedLot(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Parking Lot</DialogTitle>
            <DialogDescription>
              Update the parking lot details
            </DialogDescription>
          </DialogHeader>
          {selectedLot && (
            <form onSubmit={handleUpdateParkingLot}>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="edit-name">Name *</Label>
                    <Input id="edit-name" name="name" defaultValue={selectedLot.name} required />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-slug">Slug</Label>
                    <Input id="edit-slug" value={selectedLot.slug} disabled className="bg-muted" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="edit-venueType">Venue Type *</Label>
                    <Select name="venueType" defaultValue={selectedLot.venueType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {venueTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-status">Status *</Label>
                    <Select name="status" defaultValue={selectedLot.status}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ACTIVE">Active</SelectItem>
                        <SelectItem value="MAINTENANCE">Maintenance</SelectItem>
                        <SelectItem value="CLOSED">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-address">Address</Label>
                  <Input id="edit-address" name="address" defaultValue={selectedLot.address || ''} placeholder="Street address" />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="edit-city">City</Label>
                    <Input id="edit-city" name="city" defaultValue={selectedLot.city || ''} placeholder="City" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-state">State</Label>
                    <Input id="edit-state" name="state" defaultValue={selectedLot.state || ''} placeholder="State" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-country">Country</Label>
                    <Input id="edit-country" name="country" defaultValue={selectedLot.country} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="edit-currency">Currency</Label>
                    <Select name="currency" defaultValue={selectedLot.currency}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="INR">INR (₹)</SelectItem>
                        <SelectItem value="USD">USD ($)</SelectItem>
                        <SelectItem value="EUR">EUR (€)</SelectItem>
                        <SelectItem value="GBP">GBP (£)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex gap-6">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="hasEvCharging" className="rounded" defaultChecked={selectedLot.hasEvCharging} />
                    EV Charging
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="hasValetService" className="rounded" defaultChecked={selectedLot.hasValetService} />
                    Valet Service
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="hasMultiLevel" className="rounded" defaultChecked={selectedLot.hasMultiLevel} />
                    Multi-Level
                  </label>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={updating}>
                  {updating ? 'Updating...' : 'Update Parking Lot'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
