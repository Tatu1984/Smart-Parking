'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Line,
  LineChart,
  Pie,
  PieChart,
  Cell,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from 'recharts'
import {
  TrendingUp,
  TrendingDown,
  Banknote,
  Car,
  Clock,
  BarChart3,
  Download,
  Calendar,
} from 'lucide-react'
import { formatCurrency, type CurrencyCode } from '@/lib/utils/currency'

// Current parking lot currency - in production, fetch from context/settings
const currentCurrency: CurrencyCode = 'INR'

// Mock data for charts
const occupancyData = Array.from({ length: 24 }, (_, i) => ({
  hour: `${String(i).padStart(2, '0')}:00`,
  occupancy: Math.floor(30 + Math.random() * 60),
  entries: Math.floor(5 + Math.random() * 20),
  exits: Math.floor(5 + Math.random() * 20),
}))

const revenueData = Array.from({ length: 7 }, (_, i) => {
  const date = new Date()
  date.setDate(date.getDate() - (6 - i))
  return {
    date: date.toLocaleDateString('en-US', { weekday: 'short' }),
    revenue: Math.floor(20000 + Math.random() * 30000),
    transactions: Math.floor(100 + Math.random() * 150),
  }
})

const vehicleTypeData = [
  { type: 'Car', count: 245, color: '#3b82f6' },
  { type: 'SUV', count: 89, color: '#22c55e' },
  { type: 'Motorcycle', count: 56, color: '#f59e0b' },
  { type: 'Van', count: 23, color: '#8b5cf6' },
]

const zonePerformance = [
  { zone: 'Zone A', occupancy: 85, revenue: 15000 },
  { zone: 'Zone B', occupancy: 72, revenue: 12000 },
  { zone: 'Zone C', occupancy: 65, revenue: 10000 },
  { zone: 'VIP', occupancy: 45, revenue: 8000 },
  { zone: 'EV', occupancy: 58, revenue: 6000 },
]

const peakHoursData = [
  { hour: '08:00', entries: 45 },
  { hour: '09:00', entries: 78 },
  { hour: '10:00', entries: 52 },
  { hour: '11:00', entries: 38 },
  { hour: '12:00', entries: 65 },
  { hour: '13:00', entries: 42 },
  { hour: '17:00', entries: 85 },
  { hour: '18:00', entries: 92 },
  { hour: '19:00', entries: 68 },
]

const chartConfig = {
  occupancy: { label: 'Occupancy', color: 'hsl(var(--chart-1))' },
  entries: { label: 'Entries', color: 'hsl(var(--chart-2))' },
  exits: { label: 'Exits', color: 'hsl(var(--chart-3))' },
  revenue: { label: 'Revenue', color: 'hsl(var(--chart-1))' },
}

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
          <p className="text-muted-foreground">
            Insights and trends from your parking operations
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Select defaultValue="7d">
            <SelectTrigger className="w-[150px]">
              <Calendar className="mr-2 h-4 w-4" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">Last 24 hours</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">Total Revenue</p>
              <Banknote className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="mt-2">
              <p className="text-2xl font-bold">{formatCurrency(245670, currentCurrency)}</p>
              <div className="flex items-center gap-1 text-sm text-green-600">
                <TrendingUp className="h-4 w-4" />
                <span>+12.5% from last period</span>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">Total Vehicles</p>
              <Car className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="mt-2">
              <p className="text-2xl font-bold">1,847</p>
              <div className="flex items-center gap-1 text-sm text-green-600">
                <TrendingUp className="h-4 w-4" />
                <span>+8.2% from last period</span>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">Avg. Duration</p>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="mt-2">
              <p className="text-2xl font-bold">2h 35m</p>
              <div className="flex items-center gap-1 text-sm text-red-600">
                <TrendingDown className="h-4 w-4" />
                <span>-5.3% from last period</span>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">Peak Occupancy</p>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="mt-2">
              <p className="text-2xl font-bold">92%</p>
              <p className="text-sm text-muted-foreground">at 6:00 PM</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <Tabs defaultValue="occupancy" className="space-y-4">
        <TabsList>
          <TabsTrigger value="occupancy">Occupancy</TabsTrigger>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="traffic">Traffic</TabsTrigger>
          <TabsTrigger value="zones">Zones</TabsTrigger>
        </TabsList>

        <TabsContent value="occupancy" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Occupancy Trend</CardTitle>
              <CardDescription>
                Hourly occupancy rate over the last 24 hours
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={occupancyData}>
                    <defs>
                      <linearGradient id="occupancyGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="hour" className="text-xs" />
                    <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} className="text-xs" />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Area
                      type="monotone"
                      dataKey="occupancy"
                      stroke="hsl(var(--chart-1))"
                      fill="url(#occupancyGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="revenue" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Daily Revenue</CardTitle>
                <CardDescription>Revenue collected over the last 7 days</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={revenueData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="date" className="text-xs" />
                      <YAxis tickFormatter={(v) => `${v / 1000}k`} className="text-xs" />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="revenue" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Vehicle Types</CardTitle>
                <CardDescription>Distribution of parked vehicles</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={vehicleTypeData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={2}
                        dataKey="count"
                      >
                        {vehicleTypeData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Legend />
                      <ChartTooltip content={<ChartTooltipContent />} />
                    </PieChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="traffic" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Entries & Exits</CardTitle>
                <CardDescription>Hourly vehicle flow</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={occupancyData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="hour" className="text-xs" />
                      <YAxis className="text-xs" />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Line type="monotone" dataKey="entries" stroke="hsl(var(--chart-2))" strokeWidth={2} />
                      <Line type="monotone" dataKey="exits" stroke="hsl(var(--chart-3))" strokeWidth={2} />
                      <Legend />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Peak Hours</CardTitle>
                <CardDescription>Highest traffic hours</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={peakHoursData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis type="number" className="text-xs" />
                      <YAxis dataKey="hour" type="category" className="text-xs" />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="entries" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="zones" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Zone Performance</CardTitle>
              <CardDescription>Occupancy and revenue by zone</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {zonePerformance.map((zone) => (
                  <div key={zone.zone} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{zone.zone}</Badge>
                        <span className="text-sm text-muted-foreground">
                          {formatCurrency(zone.revenue, currentCurrency)} revenue
                        </span>
                      </div>
                      <span className="font-semibold">{zone.occupancy}%</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${zone.occupancy}%` }}
                      />
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
