'use client'

import { StatsCard } from '@/components/dashboard/stats-card'
import { OccupancyChart } from '@/components/dashboard/occupancy-chart'
import { ZoneOccupancyCard } from '@/components/dashboard/zone-occupancy-card'
import { RecentActivity } from '@/components/dashboard/recent-activity'
import { ParkingMap } from '@/components/dashboard/parking-map'
import {
  ParkingSquare,
  Car,
  IndianRupee,
  Ticket,
  Camera,
  TrendingUp,
  LogIn,
  LogOut,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

// Mock data - in production, fetch from API
const mockStats = {
  totalSlots: 450,
  occupiedSlots: 312,
  availableSlots: 138,
  occupancyRate: 69.3,
  todayEntries: 234,
  todayExits: 198,
  todayRevenue: 45670,
  activeTokens: 36,
  onlineCameras: 28,
  totalCameras: 30,
}

const mockZones = [
  { zoneId: '1', zoneName: 'Zone A - Ground Floor', zoneCode: 'A', totalSlots: 100, occupiedSlots: 85, availableSlots: 15, occupancyRate: 85 },
  { zoneId: '2', zoneName: 'Zone B - Level 1', zoneCode: 'B', totalSlots: 120, occupiedSlots: 90, availableSlots: 30, occupancyRate: 75 },
  { zoneId: '3', zoneName: 'Zone C - Level 2', zoneCode: 'C', totalSlots: 130, occupiedSlots: 78, availableSlots: 52, occupancyRate: 60 },
  { zoneId: '4', zoneName: 'VIP Parking', zoneCode: 'VIP', totalSlots: 50, occupiedSlots: 32, availableSlots: 18, occupancyRate: 64 },
  { zoneId: '5', zoneName: 'EV Charging', zoneCode: 'EV', totalSlots: 50, occupiedSlots: 27, availableSlots: 23, occupancyRate: 54 },
]

const mockOccupancyData = Array.from({ length: 24 }, (_, i) => ({
  time: `${String(i).padStart(2, '0')}:00`,
  occupancy: Math.floor(40 + Math.random() * 50),
}))

const mockActivities = [
  { id: '1', type: 'entry' as const, title: 'Vehicle Entry', description: 'KA-01-AB-1234 entered via Gate 1, allocated A-045', time: '2 min ago', status: 'success' as const },
  { id: '2', type: 'payment' as const, title: 'Payment Received', description: 'Token TK2412-XYZ paid Rs 120 via UPI', time: '5 min ago', status: 'success' as const },
  { id: '3', type: 'exit' as const, title: 'Vehicle Exit', description: 'MH-02-CD-5678 exited via Gate 2, duration 3h 45m', time: '8 min ago' },
  { id: '4', type: 'alert' as const, title: 'High Occupancy', description: 'Zone A reached 85% capacity', time: '15 min ago', status: 'warning' as const },
  { id: '5', type: 'camera' as const, title: 'Camera Online', description: 'Zone B Camera 3 reconnected', time: '20 min ago' },
  { id: '6', type: 'entry' as const, title: 'Vehicle Entry', description: 'TN-10-EF-9012 entered via Gate 1, allocated B-078', time: '25 min ago' },
  { id: '7', type: 'payment' as const, title: 'Payment Failed', description: 'Token TK2412-ABC payment declined', time: '30 min ago', status: 'error' as const },
  { id: '8', type: 'exit' as const, title: 'Vehicle Exit', description: 'DL-03-GH-3456 exited via Gate 1, duration 1h 20m', time: '35 min ago' },
]

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Real-time overview of your parking facility
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1">
            <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            Live
          </Badge>
          <span className="text-sm text-muted-foreground">
            Last updated: Just now
          </span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total Capacity"
          value={`${mockStats.occupiedSlots}/${mockStats.totalSlots}`}
          subtitle={`${mockStats.availableSlots} slots available`}
          icon={ParkingSquare}
          iconClassName="bg-blue-500/10 text-blue-500"
        />
        <StatsCard
          title="Occupancy Rate"
          value={`${mockStats.occupancyRate.toFixed(1)}%`}
          subtitle="Current utilization"
          icon={TrendingUp}
          trend={{ value: 5.2, label: 'vs yesterday', isPositive: true }}
          iconClassName="bg-green-500/10 text-green-500"
        />
        <StatsCard
          title="Today's Revenue"
          value={`Rs ${mockStats.todayRevenue.toLocaleString()}`}
          subtitle={`${mockStats.todayExits} completed transactions`}
          icon={IndianRupee}
          trend={{ value: 12.5, label: 'vs yesterday', isPositive: true }}
          iconClassName="bg-purple-500/10 text-purple-500"
        />
        <StatsCard
          title="Active Tokens"
          value={mockStats.activeTokens}
          subtitle="Vehicles currently parked"
          icon={Ticket}
          iconClassName="bg-orange-500/10 text-orange-500"
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10">
              <LogIn className="h-6 w-6 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{mockStats.todayEntries}</p>
              <p className="text-sm text-muted-foreground">Entries Today</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/10">
              <LogOut className="h-6 w-6 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{mockStats.todayExits}</p>
              <p className="text-sm text-muted-foreground">Exits Today</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-cyan-500/10">
              <Camera className="h-6 w-6 text-cyan-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {mockStats.onlineCameras}/{mockStats.totalCameras}
              </p>
              <p className="text-sm text-muted-foreground">Cameras Online</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-yellow-500/10">
              <Car className="h-6 w-6 text-yellow-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">2.5 hrs</p>
              <p className="text-sm text-muted-foreground">Avg. Duration</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Live Map and Charts - Tabbed View */}
      <Tabs defaultValue="map" className="w-full">
        <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
          <TabsTrigger value="map">Live Parking Map</TabsTrigger>
          <TabsTrigger value="charts">Occupancy Charts</TabsTrigger>
        </TabsList>
        <TabsContent value="map" className="mt-4">
          <ParkingMap />
        </TabsContent>
        <TabsContent value="charts" className="mt-4">
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <OccupancyChart data={mockOccupancyData} />
            </div>
            <div>
              <ZoneOccupancyCard zones={mockZones} />
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Recent Activity and System Status */}
      <div className="grid gap-6 lg:grid-cols-2">
        <RecentActivity activities={mockActivities} />

        {/* Quick Actions or Additional Info */}
        <Card>
          <CardHeader>
            <CardTitle>System Status</CardTitle>
            <CardDescription>Health overview of all components</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-3">
                  <div className="h-3 w-3 rounded-full bg-green-500" />
                  <span className="font-medium">AI Pipeline</span>
                </div>
                <Badge variant="default">Operational</Badge>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-3">
                  <div className="h-3 w-3 rounded-full bg-green-500" />
                  <span className="font-medium">Database</span>
                </div>
                <Badge variant="default">Healthy</Badge>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-3">
                  <div className="h-3 w-3 rounded-full bg-yellow-500" />
                  <span className="font-medium">Camera Network</span>
                </div>
                <Badge variant="secondary">2 Offline</Badge>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-3">
                  <div className="h-3 w-3 rounded-full bg-green-500" />
                  <span className="font-medium">Gate Controllers</span>
                </div>
                <Badge variant="default">All Online</Badge>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-3">
                  <div className="h-3 w-3 rounded-full bg-green-500" />
                  <span className="font-medium">Payment Gateway</span>
                </div>
                <Badge variant="default">Connected</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
