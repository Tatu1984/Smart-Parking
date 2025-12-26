'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ParkingMap } from '@/components/dashboard/parking-map'
import {
  Camera,
  Video,
  VideoOff,
  Maximize2,
  Grid3X3,
  Grid2X2,
  Square,
  RefreshCw,
  Wifi,
  WifiOff,
  Activity,
  AlertTriangle,
  Car,
  ParkingSquare,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface CameraFeed {
  id: string
  name: string
  status: 'ONLINE' | 'OFFLINE' | 'ERROR' | 'MAINTENANCE'
  zone: {
    id: string
    code: string
    name: string
  } | null
  rtspUrl: string
  lastPingAt: string | null
}

interface LiveEvent {
  id: string
  type: 'ENTRY' | 'EXIT' | 'DETECTION' | 'ALERT'
  message: string
  timestamp: Date
  vehiclePlate?: string
}

interface DashboardStats {
  totalSlots: number
  occupiedSlots: number
  availableSlots: number
}

export default function LiveViewPage() {
  const [cameras, setCameras] = useState<CameraFeed[]>([])
  const [events, setEvents] = useState<LiveEvent[]>([])
  const [stats, setStats] = useState<DashboardStats>({ totalSlots: 0, occupiedSlots: 0, availableSlots: 0 })
  const [loading, setLoading] = useState(true)
  const [gridLayout, setGridLayout] = useState<'1x1' | '2x2' | '3x3'>('2x2')
  const [selectedCamera, setSelectedCamera] = useState<string | null>(null)
  const [connected, setConnected] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchCameras = useCallback(async () => {
    try {
      const res = await fetch('/api/cameras?limit=50')
      const data = await res.json()
      if (data.success) {
        setCameras(data.data || [])
      }
    } catch (error) {
      console.error('Failed to fetch cameras:', error)
    }
  }, [])

  const fetchStats = useCallback(async () => {
    try {
      const [zonesRes, tokensRes] = await Promise.all([
        fetch('/api/zones?limit=100'),
        fetch('/api/tokens?status=ACTIVE&limit=100'),
      ])
      const zonesData = await zonesRes.json()
      const tokensData = await tokensRes.json()

      let totalSlots = 0
      let occupiedSlots = 0
      if (zonesData.success && zonesData.data) {
        zonesData.data.forEach((z: any) => {
          totalSlots += z.totalSlots || z._count?.slots || 0
          occupiedSlots += z.occupiedSlots || 0
        })
      }

      setStats({
        totalSlots,
        occupiedSlots,
        availableSlots: totalSlots - occupiedSlots,
      })
    } catch (error) {
      console.error('Failed to fetch stats:', error)
    }
  }, [])

  const fetchData = useCallback(async () => {
    setLoading(true)
    await Promise.all([fetchCameras(), fetchStats()])
    setLoading(false)
  }, [fetchCameras, fetchStats])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Real-time event simulation (would be replaced with WebSocket in production)
  useEffect(() => {
    const interval = setInterval(() => {
      const eventTypes: LiveEvent['type'][] = ['ENTRY', 'EXIT', 'DETECTION']
      const randomType = eventTypes[Math.floor(Math.random() * eventTypes.length)]
      const newEvent: LiveEvent = {
        id: Date.now().toString(),
        type: randomType,
        message: randomType === 'ENTRY'
          ? 'Vehicle entered Gate 1'
          : randomType === 'EXIT'
          ? 'Vehicle exited Gate 1'
          : 'Vehicle movement detected',
        timestamp: new Date(),
        vehiclePlate: `KA-${Math.floor(Math.random() * 99).toString().padStart(2, '0')}-${String.fromCharCode(65 + Math.floor(Math.random() * 26))}${String.fromCharCode(65 + Math.floor(Math.random() * 26))}-${Math.floor(Math.random() * 9999).toString().padStart(4, '0')}`,
      }
      setEvents(prev => [newEvent, ...prev.slice(0, 19)])
    }, 5000)

    return () => clearInterval(interval)
  }, [])

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchData()
    setRefreshing(false)
    toast.success('Data refreshed')
  }

  const getGridClass = () => {
    switch (gridLayout) {
      case '1x1':
        return 'grid-cols-1'
      case '2x2':
        return 'grid-cols-1 md:grid-cols-2'
      case '3x3':
        return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
      default:
        return 'grid-cols-2'
    }
  }

  const visibleCameras = gridLayout === '1x1'
    ? cameras.slice(0, 1)
    : gridLayout === '2x2'
    ? cameras.slice(0, 4)
    : cameras.slice(0, 9)

  const onlineCount = cameras.filter(c => c.status === 'ONLINE').length
  const totalCameras = cameras.length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Live View</h1>
          <p className="text-muted-foreground">
            Real-time monitoring of parking facility
          </p>
        </div>
        <div className="flex items-center gap-4">
          {/* Connection Status */}
          <div className="flex items-center gap-2">
            {connected ? (
              <>
                <Wifi className="h-4 w-4 text-green-500" />
                <span className="text-sm text-green-500">Connected</span>
              </>
            ) : (
              <>
                <WifiOff className="h-4 w-4 text-red-500" />
                <span className="text-sm text-red-500">Disconnected</span>
              </>
            )}
          </div>
          <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={cn("h-4 w-4 mr-2", refreshing && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500/10">
              <Camera className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="text-xl font-bold">{loading ? '-' : `${onlineCount}/${totalCameras}`}</p>
              <p className="text-xs text-muted-foreground">Cameras Online</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/10">
              <Car className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-xl font-bold">{loading ? '-' : stats.occupiedSlots}</p>
              <p className="text-xs text-muted-foreground">Vehicles Parked</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-500/10">
              <ParkingSquare className="h-5 w-5 text-purple-500" />
            </div>
            <div>
              <p className="text-xl font-bold">{loading ? '-' : stats.availableSlots}</p>
              <p className="text-xs text-muted-foreground">Available Slots</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-500/10">
              <Activity className="h-5 w-5 text-orange-500" />
            </div>
            <div>
              <p className="text-xl font-bold">{events.length}</p>
              <p className="text-xs text-muted-foreground">Events (5 min)</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="cameras" className="space-y-4">
        <TabsList>
          <TabsTrigger value="cameras" className="gap-2">
            <Video className="h-4 w-4" />
            Camera Feeds
          </TabsTrigger>
          <TabsTrigger value="map" className="gap-2">
            <ParkingSquare className="h-4 w-4" />
            Parking Map
          </TabsTrigger>
          <TabsTrigger value="events" className="gap-2">
            <Activity className="h-4 w-4" />
            Live Events
          </TabsTrigger>
        </TabsList>

        {/* Camera Feeds Tab */}
        <TabsContent value="cameras" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {loading ? 'Loading cameras...' : `Showing ${visibleCameras.length} of ${cameras.length} cameras`}
            </p>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Layout:</span>
              <div className="flex gap-1">
                <Button
                  variant={gridLayout === '1x1' ? 'default' : 'outline'}
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setGridLayout('1x1')}
                >
                  <Square className="h-4 w-4" />
                </Button>
                <Button
                  variant={gridLayout === '2x2' ? 'default' : 'outline'}
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setGridLayout('2x2')}
                >
                  <Grid2X2 className="h-4 w-4" />
                </Button>
                <Button
                  variant={gridLayout === '3x3' ? 'default' : 'outline'}
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setGridLayout('3x3')}
                >
                  <Grid3X3 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : cameras.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Camera className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="font-medium mb-1">No Cameras Found</h3>
                <p className="text-sm text-muted-foreground">Add cameras to start monitoring</p>
              </CardContent>
            </Card>
          ) : (
            <div className={cn('grid gap-4', getGridClass())}>
              {visibleCameras.map((camera) => (
                <Card key={camera.id} className="overflow-hidden">
                  <div className="aspect-video bg-slate-900 relative flex items-center justify-center">
                    {camera.status === 'ONLINE' ? (
                      <div className="text-center text-white">
                        <Video className="h-12 w-12 mx-auto mb-2 opacity-50 animate-pulse" />
                        <p className="text-sm opacity-50">Live Feed</p>
                        <p className="text-xs opacity-30 mt-1">AI Detection Active</p>
                      </div>
                    ) : (
                      <div className="text-center text-white">
                        <VideoOff className="h-12 w-12 mx-auto mb-2 opacity-30" />
                        <p className="text-sm opacity-30">No Feed</p>
                      </div>
                    )}

                    {/* Status Indicator */}
                    <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-black/50 rounded-full px-2 py-1">
                      <div className={cn(
                        'h-2 w-2 rounded-full',
                        camera.status === 'ONLINE' ? 'bg-green-500 animate-pulse' :
                        camera.status === 'MAINTENANCE' ? 'bg-yellow-500' : 'bg-red-500'
                      )} />
                      <span className="text-xs text-white">{camera.status}</span>
                    </div>

                    {/* Zone Badge */}
                    {camera.zone && (
                      <Badge
                        variant="secondary"
                        className="absolute top-2 right-2 text-xs"
                      >
                        {camera.zone.code}
                      </Badge>
                    )}

                    {/* Fullscreen Button */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute bottom-2 right-2 h-8 w-8 bg-black/50 text-white hover:bg-black/70"
                      onClick={() => setSelectedCamera(camera.id)}
                    >
                      <Maximize2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-sm">{camera.name}</h4>
                        <p className="text-xs text-muted-foreground">
                          {camera.zone ? `Zone ${camera.zone.code} - ${camera.zone.name}` : 'No zone assigned'}
                        </p>
                      </div>
                      <Camera className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Parking Map Tab */}
        <TabsContent value="map">
          <ParkingMap />
        </TabsContent>

        {/* Live Events Tab */}
        <TabsContent value="events">
          <Card>
            <CardHeader>
              <CardTitle>Live Activity Feed</CardTitle>
              <CardDescription>Real-time events from the parking facility</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 max-h-[600px] overflow-y-auto">
                {events.map((event) => (
                  <div
                    key={event.id}
                    className={cn(
                      'flex items-start gap-4 p-3 rounded-lg border',
                      event.type === 'ALERT' && 'border-red-500/50 bg-red-500/5'
                    )}
                  >
                    <div className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-full',
                      event.type === 'ENTRY' && 'bg-green-500/10',
                      event.type === 'EXIT' && 'bg-blue-500/10',
                      event.type === 'DETECTION' && 'bg-purple-500/10',
                      event.type === 'ALERT' && 'bg-red-500/10',
                    )}>
                      {event.type === 'ENTRY' && <Car className="h-4 w-4 text-green-500" />}
                      {event.type === 'EXIT' && <Car className="h-4 w-4 text-blue-500" />}
                      {event.type === 'DETECTION' && <Activity className="h-4 w-4 text-purple-500" />}
                      {event.type === 'ALERT' && <AlertTriangle className="h-4 w-4 text-red-500" />}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-sm">{event.message}</p>
                        <span className="text-xs text-muted-foreground">
                          {event.timestamp.toLocaleTimeString()}
                        </span>
                      </div>
                      {event.vehiclePlate && (
                        <Badge variant="outline" className="mt-1 font-mono text-xs">
                          {event.vehiclePlate}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
