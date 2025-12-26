'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  FileText,
  Download,
  Calendar,
  BarChart3,
  TrendingUp,
  ParkingSquare,
  Car,
  Banknote,
  Clock,
  FileSpreadsheet,
  RefreshCw,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { formatCurrency, type CurrencyCode } from '@/lib/utils/currency'

interface ReportSummary {
  totalVehicles: number
  totalRevenue: number
  avgDuration: number
  occupancyRate: number
  peakHour: string
  peakOccupancy: number
}

interface Transaction {
  id: string
  tokenNumber: string
  licensePlate: string
  entryTime: string
  exitTime: string
  duration: number
  amount: number
  paymentMethod: string
  paymentStatus: string
}

const currency: CurrencyCode = 'INR'

export default function ReportsPage() {
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [reportType, setReportType] = useState('transactions')
  const [dateRange, setDateRange] = useState('today')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [summary, setSummary] = useState<ReportSummary>({
    totalVehicles: 0,
    totalRevenue: 0,
    avgDuration: 0,
    occupancyRate: 0,
    peakHour: 'N/A',
    peakOccupancy: 0,
  })

  const fetchReportData = async () => {
    setLoading(true)
    try {
      // Fetch transactions
      const txRes = await fetch('/api/transactions?limit=50&sortBy=createdAt&sortOrder=desc')
      const txData = await txRes.json()

      if (txData.success && txData.data) {
        const formattedTx: Transaction[] = txData.data.map((t: any) => ({
          id: t.id,
          tokenNumber: t.token?.tokenNumber || 'N/A',
          licensePlate: t.token?.licensePlate || 'N/A',
          entryTime: t.token?.entryTime ? new Date(t.token.entryTime).toLocaleString() : 'N/A',
          exitTime: t.token?.exitTime ? new Date(t.token.exitTime).toLocaleString() : 'N/A',
          duration: t.token?.actualDuration || 0,
          amount: t.amount || 0,
          paymentMethod: t.paymentMethod || 'N/A',
          paymentStatus: t.paymentStatus || 'PENDING',
        }))
        setTransactions(formattedTx)

        // Calculate summary
        const totalRevenue = formattedTx.reduce((sum, t) => sum + t.amount, 0)
        const avgDuration = formattedTx.length > 0
          ? formattedTx.reduce((sum, t) => sum + t.duration, 0) / formattedTx.length
          : 0

        setSummary({
          totalVehicles: formattedTx.length,
          totalRevenue,
          avgDuration,
          occupancyRate: 72.5, // Would come from analytics API
          peakHour: '10:00 AM',
          peakOccupancy: 89,
        })
      }
    } catch (error) {
      console.error('Failed to fetch report data:', error)
      toast.error('Failed to load report data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReportData()
  }, [dateRange])

  const handleExport = async (format: 'csv' | 'pdf') => {
    setExporting(true)
    try {
      // Generate CSV data
      if (format === 'csv') {
        const headers = ['Token', 'License Plate', 'Entry Time', 'Exit Time', 'Duration (min)', 'Amount', 'Payment Method', 'Status']
        const rows = transactions.map(t => [
          t.tokenNumber,
          t.licensePlate,
          t.entryTime,
          t.exitTime,
          t.duration.toString(),
          t.amount.toString(),
          t.paymentMethod,
          t.paymentStatus,
        ])

        const csvContent = [
          headers.join(','),
          ...rows.map(row => row.join(',')),
        ].join('\n')

        const blob = new Blob([csvContent], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `parking-report-${new Date().toISOString().split('T')[0]}.csv`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        toast.success('Report exported successfully')
      } else {
        // For PDF, we would integrate a PDF library
        toast.info('PDF export coming soon')
      }
    } catch (error) {
      toast.error('Failed to export report')
    } finally {
      setExporting(false)
    }
  }

  const formatDuration = (minutes: number) => {
    if (!minutes) return 'N/A'
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (hours > 0) return `${hours}h ${mins}m`
    return `${mins}m`
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      COMPLETED: 'default',
      PENDING: 'secondary',
      FAILED: 'destructive',
    }
    return <Badge variant={variants[status] || 'outline'}>{status}</Badge>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reports & Analytics</h1>
          <p className="text-muted-foreground">
            Generate and export detailed parking reports
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={fetchReportData} disabled={loading}>
            <RefreshCw className={cn('h-4 w-4 mr-2', loading && 'animate-spin')} />
            Refresh
          </Button>
          <Button variant="outline" onClick={() => handleExport('csv')} disabled={exporting}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button onClick={() => handleExport('pdf')} disabled={exporting}>
            <Download className="h-4 w-4 mr-2" />
            Export PDF
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Report Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[150px]">
              <Label className="mb-2 block">Report Type</Label>
              <Select value={reportType} onValueChange={setReportType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="transactions">Transactions</SelectItem>
                  <SelectItem value="occupancy">Occupancy</SelectItem>
                  <SelectItem value="revenue">Revenue</SelectItem>
                  <SelectItem value="vehicles">Vehicles</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[150px]">
              <Label className="mb-2 block">Date Range</Label>
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="yesterday">Yesterday</SelectItem>
                  <SelectItem value="week">Last 7 Days</SelectItem>
                  <SelectItem value="month">Last 30 Days</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {dateRange === 'custom' && (
              <>
                <div className="flex-1 min-w-[150px]">
                  <Label className="mb-2 block">Start Date</Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="flex-1 min-w-[150px]">
                  <Label className="mb-2 block">End Date</Label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/10">
                <Car className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-xl font-bold">{summary.totalVehicles}</p>
                <p className="text-xs text-muted-foreground">Total Vehicles</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500/10">
                <Banknote className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-xl font-bold">{formatCurrency(summary.totalRevenue, currency)}</p>
                <p className="text-xs text-muted-foreground">Total Revenue</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-500/10">
                <Clock className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-xl font-bold">{formatDuration(summary.avgDuration)}</p>
                <p className="text-xs text-muted-foreground">Avg Duration</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-500/10">
                <ParkingSquare className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <p className="text-xl font-bold">{summary.occupancyRate}%</p>
                <p className="text-xs text-muted-foreground">Avg Occupancy</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-500/10">
                <TrendingUp className="h-5 w-5 text-cyan-500" />
              </div>
              <div>
                <p className="text-xl font-bold">{summary.peakHour}</p>
                <p className="text-xs text-muted-foreground">Peak Hour</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/10">
                <BarChart3 className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-xl font-bold">{summary.peakOccupancy}%</p>
                <p className="text-xs text-muted-foreground">Peak Occupancy</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Transactions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Transaction Details</CardTitle>
          <CardDescription>
            Complete list of parking transactions for the selected period
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Token</TableHead>
                  <TableHead>License Plate</TableHead>
                  <TableHead>Entry Time</TableHead>
                  <TableHead>Exit Time</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : transactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No transactions found for the selected period
                    </TableCell>
                  </TableRow>
                ) : (
                  transactions.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell className="font-medium">{tx.tokenNumber}</TableCell>
                      <TableCell>{tx.licensePlate}</TableCell>
                      <TableCell>{tx.entryTime}</TableCell>
                      <TableCell>{tx.exitTime}</TableCell>
                      <TableCell>{formatDuration(tx.duration)}</TableCell>
                      <TableCell>{formatCurrency(tx.amount, currency)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{tx.paymentMethod}</Badge>
                      </TableCell>
                      <TableCell>{getStatusBadge(tx.paymentStatus)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {transactions.length > 0 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                Showing {transactions.length} transactions
              </p>
              <p className="text-sm font-medium">
                Total: {formatCurrency(summary.totalRevenue, currency)}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
