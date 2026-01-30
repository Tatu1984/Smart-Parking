'use client'

import { StatsCard } from '@/components/dashboard/stats-card'
import { OccupancyChart } from '@/components/dashboard/occupancy-chart'
import { ZoneOccupancyCard } from '@/components/dashboard/zone-occupancy-card'
import { RecentActivity } from '@/components/dashboard/recent-activity'
import { ParkingMap } from '@/components/dashboard/parking-map'
import { formatCurrency, type CurrencyCode } from '@/lib/utils/currency'
import { useDashboardData } from '@/hooks/use-dashboard-data'
import {
  ParkingSquare,
  Car,
  Banknote,
  Ticket,
  Camera,
  TrendingUp,
  LogIn,
  LogOut,
  RefreshCw,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'

const currency: CurrencyCode = 'INR'

// Default empty stats for loading state
const emptyStats = {
  totalSlots: 0,
  occupiedSlots: 0,
  availableSlots: 0,
  occupancyRate: 0,
  todayEntries: 0,
  todayExits: 0,
  todayRevenue: 0,
  activeTokens: 0,
  onlineCameras: 0,
  totalCameras: 0,
  avgDuration: 0,
}

export default function DashboardPage() {
  const { stats: apiStats, zones, activities, loading, error, lastUpdated, refresh, occupancyData } = useDashboardData()

  // Use API data or empty defaults
  const stats = apiStats || emptyStats
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
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1">
              <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              Live
            </Badge>
            <span className="text-sm text-muted-foreground">
              {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : 'Just now'}
            </span>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total Capacity"
          value={`${stats.occupiedSlots}/${stats.totalSlots}`}
          subtitle={`${stats.availableSlots} slots available`}
          icon={ParkingSquare}
          iconClassName="bg-blue-500/10 text-blue-500"
        />
        <StatsCard
          title="Occupancy Rate"
          value={`${stats.occupancyRate.toFixed(1)}%`}
          subtitle="Current utilization"
          icon={TrendingUp}
          trend={{ value: 5.2, label: 'vs yesterday', isPositive: true }}
          iconClassName="bg-green-500/10 text-green-500"
        />
        <StatsCard
          title="Today's Revenue"
          value={formatCurrency(stats.todayRevenue, currency)}
          subtitle={`${stats.todayExits} completed transactions`}
          icon={Banknote}
          trend={{ value: 12.5, label: 'vs yesterday', isPositive: true }}
          iconClassName="bg-purple-500/10 text-purple-500"
        />
        <StatsCard
          title="Active Tokens"
          value={stats.activeTokens}
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
              <p className="text-2xl font-bold">{stats.todayEntries}</p>
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
              <p className="text-2xl font-bold">{stats.todayExits}</p>
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
                {stats.onlineCameras}/{stats.totalCameras}
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
              <p className="text-2xl font-bold">
                {stats.avgDuration > 0 ? `${Math.round(stats.avgDuration / 60)}h ${stats.avgDuration % 60}m` : '2.5 hrs'}
              </p>
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
              <OccupancyChart data={occupancyData} />
            </div>
            <div>
              <ZoneOccupancyCard zones={zones} />
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Recent Activity and System Status */}
      <div className="grid gap-6 lg:grid-cols-2">
        <RecentActivity activities={activities} />

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
