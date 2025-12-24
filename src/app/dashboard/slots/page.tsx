'use client'

import { useState } from 'react'
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
  Edit,
  Trash2,
  Eye,
  Wrench,
  Car,
  Zap,
  Accessibility,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// Mock data
const mockSlots = [
  { id: '1', slotNumber: 'A-001', zone: 'Zone A', level: 0, type: 'STANDARD', vehicleType: 'CAR', status: 'AVAILABLE', isOccupied: false, hasEvCharger: false, isAccessible: false },
  { id: '2', slotNumber: 'A-002', zone: 'Zone A', level: 0, type: 'STANDARD', vehicleType: 'CAR', status: 'OCCUPIED', isOccupied: true, hasEvCharger: false, isAccessible: false },
  { id: '3', slotNumber: 'A-003', zone: 'Zone A', level: 0, type: 'HANDICAPPED', vehicleType: 'CAR', status: 'AVAILABLE', isOccupied: false, hasEvCharger: false, isAccessible: true },
  { id: '4', slotNumber: 'B-001', zone: 'Zone B', level: 1, type: 'EV_CHARGING', vehicleType: 'CAR', status: 'OCCUPIED', isOccupied: true, hasEvCharger: true, isAccessible: false },
  { id: '5', slotNumber: 'B-002', zone: 'Zone B', level: 1, type: 'STANDARD', vehicleType: 'CAR', status: 'MAINTENANCE', isOccupied: false, hasEvCharger: false, isAccessible: false },
  { id: '6', slotNumber: 'C-001', zone: 'Zone C', level: 2, type: 'VIP', vehicleType: 'CAR', status: 'RESERVED', isOccupied: false, hasEvCharger: false, isAccessible: false },
  { id: '7', slotNumber: 'C-002', zone: 'Zone C', level: 2, type: 'STANDARD', vehicleType: 'SUV', status: 'AVAILABLE', isOccupied: false, hasEvCharger: false, isAccessible: false },
  { id: '8', slotNumber: 'M-001', zone: 'Zone M', level: 0, type: 'MOTORCYCLE', vehicleType: 'MOTORCYCLE', status: 'OCCUPIED', isOccupied: true, hasEvCharger: false, isAccessible: false },
]

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
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [zoneFilter, setZoneFilter] = useState<string>('all')

  const filteredSlots = mockSlots.filter((slot) => {
    const matchesSearch = slot.slotNumber.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = statusFilter === 'all' || slot.status === statusFilter
    const matchesZone = zoneFilter === 'all' || slot.zone === zoneFilter
    return matchesSearch && matchesStatus && matchesZone
  })

  const stats = {
    total: mockSlots.length,
    available: mockSlots.filter((s) => s.status === 'AVAILABLE').length,
    occupied: mockSlots.filter((s) => s.isOccupied).length,
    maintenance: mockSlots.filter((s) => s.status === 'MAINTENANCE').length,
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
        <Dialog>
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
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="zone">Zone</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Select zone" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="zone-a">Zone A - Ground Floor</SelectItem>
                    <SelectItem value="zone-b">Zone B - Level 1</SelectItem>
                    <SelectItem value="zone-c">Zone C - Level 2</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="prefix">Prefix</Label>
                  <Input id="prefix" placeholder="A" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="count">Count</Label>
                  <Input id="count" type="number" placeholder="50" />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="type">Slot Type</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
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
            </div>
            <DialogFooter>
              <Button type="submit">Create Slots</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
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
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Zone" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Zones</SelectItem>
                  <SelectItem value="Zone A">Zone A</SelectItem>
                  <SelectItem value="Zone B">Zone B</SelectItem>
                  <SelectItem value="Zone C">Zone C</SelectItem>
                  <SelectItem value="Zone M">Zone M</SelectItem>
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
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSlots.map((slot) => (
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
                        <span>{slot.zone}</span>
                        <span className="text-xs text-muted-foreground">
                          Level {slot.level}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{slot.type}</Badge>
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
                          <DropdownMenuItem>
                            <Eye className="mr-2 h-4 w-4" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Wrench className="mr-2 h-4 w-4" />
                            Mark Maintenance
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive">
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
