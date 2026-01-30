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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  CreditCard,
  Search,
  Filter,
  Eye,
  Download,
  RefreshCw,
  Banknote,
  TrendingUp,
  Receipt,
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency, type CurrencyCode } from '@/lib/utils/currency'
import { toast } from 'sonner'

interface Transaction {
  id: string
  receiptNumber: string
  entryTime: string
  exitTime: string | null
  duration: number | null
  grossAmount: number
  tax: number
  discount: number
  netAmount: number
  currency: string
  paymentStatus: string
  paymentMethod: string | null
  paymentRef: string | null
  paidAt: string | null
  token: {
    id: string
    tokenNumber: string
    licensePlate: string | null
    vehicleType: string | null
    allocatedSlot: {
      slotNumber: string
      zone: {
        name: string
        code: string
      }
    } | null
  }
  parkingLot: {
    id: string
    name: string
  }
  createdAt: string
}

const paymentStatusConfig: Record<string, { color: string; icon: typeof CheckCircle; label: string }> = {
  PENDING: { color: 'bg-yellow-500', icon: AlertCircle, label: 'Pending' },
  COMPLETED: { color: 'bg-green-500', icon: CheckCircle, label: 'Completed' },
  FAILED: { color: 'bg-red-500', icon: XCircle, label: 'Failed' },
  REFUNDED: { color: 'bg-purple-500', icon: RefreshCw, label: 'Refunded' },
  WAIVED: { color: 'bg-gray-500', icon: CheckCircle, label: 'Waived' },
}

const paymentMethodLabels: Record<string, string> = {
  CASH: 'Cash',
  CARD: 'Card',
  UPI: 'UPI',
  WALLET: 'Wallet',
  POSTPAID: 'Postpaid',
  FREE: 'Free',
}

function formatDuration(minutes: number | null): string {
  if (!minutes) return 'N/A'
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours > 0) {
    return `${hours}h ${mins}m`
  }
  return `${mins}m`
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [methodFilter, setMethodFilter] = useState<string>('all')
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null)
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 })
  const [dateRange, setDateRange] = useState({ from: '', to: '' })

  const currency: CurrencyCode = 'INR'

  const fetchTransactions = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...(search && { search }),
        ...(statusFilter !== 'all' && { paymentStatus: statusFilter }),
        ...(methodFilter !== 'all' && { paymentMethod: methodFilter }),
        ...(dateRange.from && { dateFrom: dateRange.from }),
        ...(dateRange.to && { dateTo: dateRange.to }),
      })
      const res = await fetch(`/api/transactions?${params}`)
      const data = await res.json()
      if (data.success) {
        setTransactions(data.data || [])
        setPagination(prev => ({ ...prev, ...data.pagination }))
      }
    } catch (error) {
      logger.error('Failed to fetch transactions:', error instanceof Error ? error : undefined)
      toast.error('Failed to load transactions')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTransactions()
  }, [pagination.page, statusFilter, methodFilter, dateRange.from, dateRange.to])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (pagination.page === 1) {
        fetchTransactions()
      } else {
        setPagination(prev => ({ ...prev, page: 1 }))
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  const handleExport = () => {
    toast.info('Export functionality coming soon')
  }

  // Calculate stats from current page data
  const stats = {
    total: pagination.total,
    completed: transactions.filter(t => t.paymentStatus === 'COMPLETED').length,
    pending: transactions.filter(t => t.paymentStatus === 'PENDING').length,
    totalRevenue: transactions.reduce((acc, t) => acc + (t.paymentStatus === 'COMPLETED' ? t.netAmount : 0), 0),
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Transactions</h1>
          <p className="text-muted-foreground">
            View and manage parking transactions
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={fetchTransactions} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
            Refresh
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/10">
              <Receipt className="h-6 w-6 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-sm text-muted-foreground">Total Transactions</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10">
              <CheckCircle className="h-6 w-6 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.completed}</p>
              <p className="text-sm text-muted-foreground">Completed</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-yellow-500/10">
              <AlertCircle className="h-6 w-6 text-yellow-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.pending}</p>
              <p className="text-sm text-muted-foreground">Pending</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-500/10">
              <Banknote className="h-6 w-6 text-purple-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{formatCurrency(stats.totalRevenue, currency)}</p>
              <p className="text-sm text-muted-foreground">Page Revenue</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Table */}
      <Card>
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
          <CardDescription>Complete list of all parking transactions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
            <div className="flex flex-1 flex-wrap gap-4">
              <div className="relative flex-1 md:max-w-sm">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search receipts or tokens..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px]">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="COMPLETED">Completed</SelectItem>
                  <SelectItem value="FAILED">Failed</SelectItem>
                  <SelectItem value="REFUNDED">Refunded</SelectItem>
                </SelectContent>
              </Select>
              <Select value={methodFilter} onValueChange={setMethodFilter}>
                <SelectTrigger className="w-[140px]">
                  <CreditCard className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Methods</SelectItem>
                  <SelectItem value="CASH">Cash</SelectItem>
                  <SelectItem value="CARD">Card</SelectItem>
                  <SelectItem value="UPI">UPI</SelectItem>
                  <SelectItem value="WALLET">Wallet</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex gap-2 items-center">
                <Input
                  type="date"
                  value={dateRange.from}
                  onChange={(e) => setDateRange(d => ({ ...d, from: e.target.value }))}
                  className="w-[140px]"
                />
                <span className="text-muted-foreground">to</span>
                <Input
                  type="date"
                  value={dateRange.to}
                  onChange={(e) => setDateRange(d => ({ ...d, to: e.target.value }))}
                  className="w-[140px]"
                />
              </div>
            </div>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Receipt</TableHead>
                  <TableHead>Token</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
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
                      No transactions found
                    </TableCell>
                  </TableRow>
                ) : (
                  transactions.map((tx) => {
                    const statusConfig = paymentStatusConfig[tx.paymentStatus] || paymentStatusConfig.PENDING
                    const StatusIcon = statusConfig.icon

                    return (
                      <TableRow key={tx.id}>
                        <TableCell>
                          <div>
                            <span className="font-medium font-mono text-sm">{tx.receiptNumber || 'N/A'}</span>
                            <p className="text-xs text-muted-foreground">
                              {new Date(tx.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="font-mono text-sm">{tx.token.tokenNumber}</span>
                        </TableCell>
                        <TableCell>
                          <div>
                            <span>{tx.token.licensePlate || 'N/A'}</span>
                            {tx.token.allocatedSlot && (
                              <p className="text-xs text-muted-foreground">
                                {tx.token.allocatedSlot.zone.code} - {tx.token.allocatedSlot.slotNumber}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            <span>{formatDuration(tx.duration)}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <span className="font-medium">{formatCurrency(tx.netAmount, currency)}</span>
                            {tx.tax > 0 && (
                              <p className="text-xs text-muted-foreground">
                                +{formatCurrency(tx.tax, currency)} tax
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {tx.paymentMethod ? (
                            <Badge variant="outline">
                              {paymentMethodLabels[tx.paymentMethod] || tx.paymentMethod}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <StatusIcon className={cn('h-4 w-4',
                              tx.paymentStatus === 'COMPLETED' && 'text-green-500',
                              tx.paymentStatus === 'PENDING' && 'text-yellow-500',
                              tx.paymentStatus === 'FAILED' && 'text-red-500',
                            )} />
                            <Badge variant={tx.paymentStatus === 'COMPLETED' ? 'default' : 'outline'}>
                              {statusConfig.label}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setSelectedTransaction(tx)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })
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

      {/* Transaction Details Dialog */}
      <Dialog open={!!selectedTransaction} onOpenChange={() => setSelectedTransaction(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Transaction Details</DialogTitle>
            <DialogDescription>
              Receipt: {selectedTransaction?.receiptNumber}
            </DialogDescription>
          </DialogHeader>
          {selectedTransaction && (
            <div className="space-y-6">
              {/* Summary */}
              <div className="p-4 bg-muted rounded-lg text-center">
                <p className="text-3xl font-bold">
                  {formatCurrency(selectedTransaction.netAmount, currency)}
                </p>
                <Badge
                  className="mt-2"
                  variant={selectedTransaction.paymentStatus === 'COMPLETED' ? 'default' : 'outline'}
                >
                  {paymentStatusConfig[selectedTransaction.paymentStatus]?.label || selectedTransaction.paymentStatus}
                </Badge>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <Label className="text-muted-foreground">Token</Label>
                  <p className="font-medium font-mono">{selectedTransaction.token.tokenNumber}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Vehicle</Label>
                  <p className="font-medium">{selectedTransaction.token.licensePlate || 'N/A'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Slot</Label>
                  <p className="font-medium">
                    {selectedTransaction.token.allocatedSlot
                      ? `${selectedTransaction.token.allocatedSlot.zone.code} - ${selectedTransaction.token.allocatedSlot.slotNumber}`
                      : 'N/A'}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Duration</Label>
                  <p className="font-medium">{formatDuration(selectedTransaction.duration)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Entry Time</Label>
                  <p className="font-medium">{new Date(selectedTransaction.entryTime).toLocaleString()}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Exit Time</Label>
                  <p className="font-medium">
                    {selectedTransaction.exitTime
                      ? new Date(selectedTransaction.exitTime).toLocaleString()
                      : 'N/A'}
                  </p>
                </div>
              </div>

              {/* Amount Breakdown */}
              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Gross Amount</span>
                  <span>{formatCurrency(selectedTransaction.grossAmount, currency)}</span>
                </div>
                {selectedTransaction.discount > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Discount</span>
                    <span>-{formatCurrency(selectedTransaction.discount, currency)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tax (GST)</span>
                  <span>{formatCurrency(selectedTransaction.tax, currency)}</span>
                </div>
                <div className="flex justify-between font-medium pt-2 border-t">
                  <span>Net Amount</span>
                  <span>{formatCurrency(selectedTransaction.netAmount, currency)}</span>
                </div>
              </div>

              {/* Payment Info */}
              {selectedTransaction.paymentMethod && (
                <div className="border-t pt-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Payment Method</span>
                    <span>{paymentMethodLabels[selectedTransaction.paymentMethod] || selectedTransaction.paymentMethod}</span>
                  </div>
                  {selectedTransaction.paymentRef && (
                    <div className="flex justify-between text-sm mt-1">
                      <span className="text-muted-foreground">Reference</span>
                      <span className="font-mono">{selectedTransaction.paymentRef}</span>
                    </div>
                  )}
                  {selectedTransaction.paidAt && (
                    <div className="flex justify-between text-sm mt-1">
                      <span className="text-muted-foreground">Paid At</span>
                      <span>{new Date(selectedTransaction.paidAt).toLocaleString()}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
