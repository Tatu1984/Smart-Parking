'use client'

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
  Camera,
  Plus,
  Search,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  RefreshCw,
  Video,
  VideoOff,
  Settings,
  Wifi,
  WifiOff,
  Zap,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface CameraData {
  id: string
  name: string
  rtspUrl: string
  onvifUrl: string | null
  status: string
  resolution: string | null
  frameRate: number | null
  positionDescription: string | null
  coverageSlots: number
  hasIR: boolean
  hasPTZ: boolean
  isActive: boolean
  lastSeenAt: string | null
  parkingLot: {
    id: string
    name: string
  }
  zone: {
    id: string
    name: string
    code: string
  } | null
  _count: {
    slots: number
  }
}

const statusConfig: Record<string, { color: string; icon: typeof CheckCircle; label: string }> = {
  ONLINE: { color: 'bg-green-500', icon: CheckCircle, label: 'Online' },
  OFFLINE: { color: 'bg-red-500', icon: WifiOff, label: 'Offline' },
  MAINTENANCE: { color: 'bg-yellow-500', icon: AlertTriangle, label: 'Maintenance' },
  ERROR: { color: 'bg-red-500', icon: AlertTriangle, label: 'Error' },
}

export default function CamerasPage() {
  const [cameras, setCameras] = useState<CameraData[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [selectedCamera, setSelectedCamera] = useState<CameraData | null>(null)
  const [editingCamera, setEditingCamera] = useState<CameraData | null>(null)

  const fetchCameras = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        ...(search && { search }),
        ...(statusFilter !== 'all' && { status: statusFilter }),
      })
      const res = await fetch(`/api/cameras?${params}`)
      const data = await res.json()
      if (data.success) {
        setCameras(data.data || [])
      }
    } catch (error) {
      console.error('Failed to fetch cameras:', error)
      toast.error('Failed to load cameras')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCameras()
  }, [statusFilter])

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchCameras()
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  const handleCreateCamera = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setCreating(true)
    const formData = new FormData(e.currentTarget)

    try {
      const res = await fetch('/api/cameras', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parkingLotId: formData.get('parkingLotId'),
          zoneId: formData.get('zoneId') || undefined,
          name: formData.get('name'),
          rtspUrl: formData.get('rtspUrl'),
          onvifUrl: formData.get('onvifUrl') || undefined,
          username: formData.get('username') || undefined,
          password: formData.get('password') || undefined,
          positionDescription: formData.get('positionDescription') || undefined,
          coverageSlots: parseInt(formData.get('coverageSlots') as string) || 10,
          hasIR: formData.get('hasIR') === 'on',
          hasPTZ: formData.get('hasPTZ') === 'on',
        }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success('Camera added successfully')
        setIsCreateOpen(false)
        fetchCameras()
      } else {
        toast.error(data.error || 'Failed to add camera')
      }
    } catch (error) {
      toast.error('Failed to add camera')
    } finally {
      setCreating(false)
    }
  }

  const handleToggleActive = async (cameraId: string, isActive: boolean) => {
    try {
      const res = await fetch(`/api/cameras/${cameraId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success(`Camera ${isActive ? 'activated' : 'deactivated'}`)
        fetchCameras()
      } else {
        toast.error(data.error || 'Failed to update camera')
      }
    } catch (error) {
      toast.error('Failed to update camera')
    }
  }

  const handleDelete = async (cameraId: string) => {
    if (!confirm('Are you sure you want to delete this camera?')) return

    try {
      const res = await fetch(`/api/cameras/${cameraId}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (data.success) {
        toast.success('Camera deleted')
        setSelectedCamera(null)
        fetchCameras()
      } else {
        toast.error(data.error || 'Failed to delete camera')
      }
    } catch (error) {
      toast.error('Failed to delete camera')
    }
  }

  const stats = {
    total: cameras.length,
    online: cameras.filter(c => c.status === 'ONLINE').length,
    offline: cameras.filter(c => c.status === 'OFFLINE').length,
    active: cameras.filter(c => c.isActive).length,
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Camera Management</h1>
          <p className="text-muted-foreground">
            Configure and monitor parking cameras
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={fetchCameras} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
            Refresh
          </Button>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Add Camera
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Add New Camera</DialogTitle>
                <DialogDescription>
                  Configure a new IP camera for the parking system
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateCamera}>
                <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
                  <div className="grid gap-2">
                    <Label htmlFor="parkingLotId">Parking Lot ID *</Label>
                    <Input id="parkingLotId" name="parkingLotId" placeholder="Enter parking lot ID" required />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="zoneId">Zone ID (Optional)</Label>
                    <Input id="zoneId" name="zoneId" placeholder="Enter zone ID" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="name">Camera Name *</Label>
                    <Input id="name" name="name" placeholder="e.g., Entry Gate Camera 1" required />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="rtspUrl">RTSP URL *</Label>
                    <Input id="rtspUrl" name="rtspUrl" placeholder="rtsp://camera-ip:554/stream" required />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="onvifUrl">ONVIF URL (Optional)</Label>
                    <Input id="onvifUrl" name="onvifUrl" placeholder="http://camera-ip:80/onvif" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="username">Username</Label>
                      <Input id="username" name="username" placeholder="admin" />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="password">Password</Label>
                      <Input id="password" name="password" type="password" placeholder="••••••" />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="positionDescription">Position Description</Label>
                    <Input id="positionDescription" name="positionDescription" placeholder="e.g., Main entrance, facing north" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="coverageSlots">Coverage (slots)</Label>
                    <Input id="coverageSlots" name="coverageSlots" type="number" defaultValue={10} min={1} />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="hasIR">Infrared (Night Vision)</Label>
                    <Switch id="hasIR" name="hasIR" />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="hasPTZ">Pan-Tilt-Zoom (PTZ)</Label>
                    <Switch id="hasPTZ" name="hasPTZ" />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={creating}>
                    {creating ? 'Adding...' : 'Add Camera'}
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
              <Camera className="h-6 w-6 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-sm text-muted-foreground">Total Cameras</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10">
              <Wifi className="h-6 w-6 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.online}</p>
              <p className="text-sm text-muted-foreground">Online</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
              <WifiOff className="h-6 w-6 text-red-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.offline}</p>
              <p className="text-sm text-muted-foreground">Offline</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-500/10">
              <Zap className="h-6 w-6 text-purple-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.active}</p>
              <p className="text-sm text-muted-foreground">Active</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <div className="relative flex-1 md:max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search cameras..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="ONLINE">Online</SelectItem>
            <SelectItem value="OFFLINE">Offline</SelectItem>
            <SelectItem value="MAINTENANCE">Maintenance</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Camera Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <div className="aspect-video bg-muted" />
              <CardContent className="p-4">
                <div className="h-5 bg-muted rounded w-1/2 mb-2" />
                <div className="h-4 bg-muted rounded w-3/4" />
              </CardContent>
            </Card>
          ))
        ) : cameras.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Camera className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium">No cameras found</p>
              <p className="text-muted-foreground">Add your first camera to get started</p>
            </CardContent>
          </Card>
        ) : (
          cameras.map((camera) => {
            const config = statusConfig[camera.status] || statusConfig.OFFLINE
            const StatusIcon = config.icon

            return (
              <Card key={camera.id} className="overflow-hidden">
                {/* Camera Preview Placeholder */}
                <div className="aspect-video bg-slate-900 relative flex items-center justify-center">
                  {camera.status === 'ONLINE' && camera.isActive ? (
                    <div className="text-center text-white">
                      <Video className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm opacity-50">Live Feed</p>
                    </div>
                  ) : (
                    <div className="text-center text-white">
                      <VideoOff className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm opacity-30">No Feed</p>
                    </div>
                  )}
                  {/* Status Indicator */}
                  <div className="absolute top-2 right-2 flex items-center gap-1.5 bg-black/50 rounded-full px-2 py-1">
                    <div className={cn('h-2 w-2 rounded-full', config.color)} />
                    <span className="text-xs text-white">{config.label}</span>
                  </div>
                  {/* Features */}
                  <div className="absolute bottom-2 left-2 flex gap-1">
                    {camera.hasIR && (
                      <Badge variant="secondary" className="text-xs">IR</Badge>
                    )}
                    {camera.hasPTZ && (
                      <Badge variant="secondary" className="text-xs">PTZ</Badge>
                    )}
                  </div>
                </div>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold">{camera.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {camera.zone?.code || camera.parkingLot.name}
                        {camera._count.slots > 0 && ` • ${camera._count.slots} slots`}
                      </p>
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
                        <DropdownMenuItem onClick={() => setSelectedCamera(camera)}>
                          <Eye className="mr-2 h-4 w-4" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setEditingCamera(camera)}>
                          <Settings className="mr-2 h-4 w-4" />
                          Configure
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleToggleActive(camera.id, !camera.isActive)}>
                          {camera.isActive ? (
                            <>
                              <VideoOff className="mr-2 h-4 w-4" />
                              Deactivate
                            </>
                          ) : (
                            <>
                              <Video className="mr-2 h-4 w-4" />
                              Activate
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => handleDelete(camera.id)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {camera.lastSeenAt
                        ? `Last seen: ${new Date(camera.lastSeenAt).toLocaleString()}`
                        : 'Never connected'}
                    </span>
                    <Switch
                      checked={camera.isActive}
                      onCheckedChange={(v) => handleToggleActive(camera.id, v)}
                    />
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>

      {/* Camera Details Dialog */}
      <Dialog open={!!selectedCamera} onOpenChange={() => setSelectedCamera(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedCamera?.name}</DialogTitle>
            <DialogDescription>Camera details and configuration</DialogDescription>
          </DialogHeader>
          {selectedCamera && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <div className={cn('h-2 w-2 rounded-full', statusConfig[selectedCamera.status]?.color)} />
                    <span className="font-medium">{statusConfig[selectedCamera.status]?.label || selectedCamera.status}</span>
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Active</Label>
                  <p className="font-medium">{selectedCamera.isActive ? 'Yes' : 'No'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Zone</Label>
                  <p className="font-medium">{selectedCamera.zone?.name || 'Not assigned'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Parking Lot</Label>
                  <p className="font-medium">{selectedCamera.parkingLot.name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Coverage</Label>
                  <p className="font-medium">{selectedCamera.coverageSlots} slots</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Mapped Slots</Label>
                  <p className="font-medium">{selectedCamera._count.slots}</p>
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground">RTSP URL</Label>
                <p className="font-mono text-sm bg-muted p-2 rounded mt-1 break-all">
                  {selectedCamera.rtspUrl}
                </p>
              </div>
              {selectedCamera.positionDescription && (
                <div>
                  <Label className="text-muted-foreground">Position</Label>
                  <p className="font-medium">{selectedCamera.positionDescription}</p>
                </div>
              )}
              <div className="flex gap-2">
                {selectedCamera.hasIR && <Badge>Infrared</Badge>}
                {selectedCamera.hasPTZ && <Badge>PTZ</Badge>}
                {selectedCamera.resolution && <Badge variant="outline">{selectedCamera.resolution}</Badge>}
                {selectedCamera.frameRate && <Badge variant="outline">{selectedCamera.frameRate} fps</Badge>}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
