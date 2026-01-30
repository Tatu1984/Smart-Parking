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
  Ticket,
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  Eye,
  LogOut,
  QrCode,
  Clock,
  Car,
  MapPin,
  RefreshCw,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency, type CurrencyCode } from '@/lib/utils/currency'
import { toast } from 'sonner'

interface Token {
  id: string
  tokenNumber: string
  tokenType: string
  licensePlate: string | null
  vehicleType: string | null
  status: string
  entryTime: string
  exitTime: string | null
  duration: number
  allocatedSlot: {
    id: string
    slotNumber: string
    zone: {
      id: string
      name: string
      code: string
      level: number
    }
  } | null
  parkingLot: {
    id: string
    name: string
  }
  estimatedFee?: number
}

const statusColors: Record<string, string> = {
  ACTIVE: 'bg-green-500',
  COMPLETED: 'bg-blue-500',
  EXPIRED: 'bg-yellow-500',
  LOST: 'bg-red-500',
  CANCELLED: 'bg-gray-500',
}

const statusBadgeVariants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  ACTIVE: 'default',
  COMPLETED: 'secondary',
  EXPIRED: 'outline',
  LOST: 'destructive',
  CANCELLED: 'outline',
}

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours > 0) {
    return `${hours}h ${mins}m`
  }
  return `${mins}m`
}

export default function TokensPage() {
  const [tokens, setTokens] = useState<Token[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [selectedToken, setSelectedToken] = useState<Token | null>(null)
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 })

  const currency: CurrencyCode = 'INR'

  const fetchTokens = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...(search && { search }),
        ...(statusFilter !== 'all' && { status: statusFilter }),
      })
      const res = await fetch(`/api/tokens?${params}`)
      const data = await res.json()
      if (data.success) {
        setTokens(data.data || [])
        setPagination(prev => ({ ...prev, ...data.pagination }))
      }
    } catch (error) {
      logger.error('Failed to fetch tokens:', error instanceof Error ? error : undefined)
      toast.error('Failed to load tokens')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTokens()
  }, [pagination.page, statusFilter])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (pagination.page === 1) {
        fetchTokens()
      } else {
        setPagination(prev => ({ ...prev, page: 1 }))
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  const handleCreateToken = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setCreating(true)
    const formData = new FormData(e.currentTarget)

    try {
      const res = await fetch('/api/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parkingLotId: formData.get('parkingLotId'),
          tokenType: formData.get('tokenType') || 'QR_CODE',
          licensePlate: formData.get('licensePlate') || undefined,
          vehicleType: formData.get('vehicleType') || undefined,
        }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success('Token created successfully')
        setIsCreateOpen(false)
        fetchTokens()
      } else {
        toast.error(data.error || 'Failed to create token')
      }
    } catch (error) {
      toast.error('Failed to create token')
    } finally {
      setCreating(false)
    }
  }

  const handleCompleteToken = async (tokenId: string, paymentMethod: string) => {
    try {
      const res = await fetch(`/api/tokens/${tokenId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'complete',
          paymentMethod,
        }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success('Token completed successfully')
        setSelectedToken(null)
        fetchTokens()
      } else {
        toast.error(data.error || 'Failed to complete token')
      }
    } catch (error) {
      toast.error('Failed to complete token')
    }
  }

  const stats = {
    active: tokens.filter(t => t.status === 'ACTIVE').length,
    completed: tokens.filter(t => t.status === 'COMPLETED').length,
    total: pagination.total,
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Token Management</h1>
          <p className="text-muted-foreground">
            Manage parking tokens and vehicle entries
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={fetchTokens} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
            Refresh
          </Button>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                New Token
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Token</DialogTitle>
                <DialogDescription>
                  Generate a new parking token for vehicle entry
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateToken}>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="parkingLotId">Parking Lot ID</Label>
                    <Input id="parkingLotId" name="parkingLotId" placeholder="Enter parking lot ID" required />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="tokenType">Token Type</Label>
                    <Select name="tokenType" defaultValue="QR_CODE">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="QR_CODE">QR Code</SelectItem>
                        <SelectItem value="RFID">RFID</SelectItem>
                        <SelectItem value="BARCODE">Barcode</SelectItem>
                        <SelectItem value="ANPR">ANPR</SelectItem>
                        <SelectItem value="MANUAL">Manual</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="licensePlate">License Plate (Optional)</Label>
                    <Input id="licensePlate" name="licensePlate" placeholder="e.g., KA-01-AB-1234" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="vehicleType">Vehicle Type</Label>
                    <Select name="vehicleType" defaultValue="CAR">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CAR">Car</SelectItem>
                        <SelectItem value="SUV">SUV</SelectItem>
                        <SelectItem value="MOTORCYCLE">Motorcycle</SelectItem>
                        <SelectItem value="BUS">Bus</SelectItem>
                        <SelectItem value="TRUCK">Truck</SelectItem>
                        <SelectItem value="VAN">Van</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={creating}>
                    {creating ? 'Creating...' : 'Create Token'}
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
              <Ticket className="h-6 w-6 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-sm text-muted-foreground">Total Tokens</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10">
              <Clock className="h-6 w-6 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.active}</p>
              <p className="text-sm text-muted-foreground">Active</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-500/10">
              <LogOut className="h-6 w-6 text-purple-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.completed}</p>
              <p className="text-sm text-muted-foreground">Completed Today</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-500/10">
              <QrCode className="h-6 w-6 text-orange-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">QR</p>
              <p className="text-sm text-muted-foreground">Primary Type</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Tokens</CardTitle>
          <CardDescription>View and manage parking tokens</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
            <div className="flex flex-1 gap-4">
              <div className="relative flex-1 md:max-w-sm">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search tokens or plates..."
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
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="COMPLETED">Completed</SelectItem>
                  <SelectItem value="EXPIRED">Expired</SelectItem>
                  <SelectItem value="LOST">Lost</SelectItem>
                  <SelectItem value="CANCELLED">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Token</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Slot</TableHead>
                  <TableHead>Entry Time</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : tokens.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No tokens found
                    </TableCell>
                  </TableRow>
                ) : (
                  tokens.map((token) => (
                    <TableRow key={token.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className={cn('h-2 w-2 rounded-full', statusColors[token.status])} />
                          <div>
                            <span className="font-medium font-mono">{token.tokenNumber}</span>
                            <p className="text-xs text-muted-foreground">{token.tokenType}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Car className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <span>{token.licensePlate || 'N/A'}</span>
                            {token.vehicleType && (
                              <p className="text-xs text-muted-foreground">{token.vehicleType}</p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {token.allocatedSlot ? (
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <span>{token.allocatedSlot.slotNumber}</span>
                              <p className="text-xs text-muted-foreground">
                                {token.allocatedSlot.zone.code} - Level {token.allocatedSlot.zone.level}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Not assigned</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div>
                          <span>{new Date(token.entryTime).toLocaleTimeString()}</span>
                          <p className="text-xs text-muted-foreground">
                            {new Date(token.entryTime).toLocaleDateString()}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{formatDuration(token.duration)}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusBadgeVariants[token.status]}>
                          {token.status}
                        </Badge>
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
                            <DropdownMenuItem onClick={() => setSelectedToken(token)}>
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            {token.status === 'ACTIVE' && (
                              <DropdownMenuItem onClick={() => setSelectedToken(token)}>
                                <LogOut className="mr-2 h-4 w-4" />
                                Process Exit
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
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

      {/* Token Details Dialog */}
      <Dialog open={!!selectedToken} onOpenChange={() => setSelectedToken(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Token Details</DialogTitle>
            <DialogDescription>
              {selectedToken?.tokenNumber}
            </DialogDescription>
          </DialogHeader>
          {selectedToken && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <Badge variant={statusBadgeVariants[selectedToken.status]} className="mt-1">
                    {selectedToken.status}
                  </Badge>
                </div>
                <div>
                  <Label className="text-muted-foreground">Duration</Label>
                  <p className="font-medium">{formatDuration(selectedToken.duration)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Vehicle</Label>
                  <p className="font-medium">{selectedToken.licensePlate || 'N/A'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Type</Label>
                  <p className="font-medium">{selectedToken.vehicleType || 'N/A'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Slot</Label>
                  <p className="font-medium">
                    {selectedToken.allocatedSlot?.slotNumber || 'Not assigned'}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Entry Time</Label>
                  <p className="font-medium">
                    {new Date(selectedToken.entryTime).toLocaleString()}
                  </p>
                </div>
              </div>

              {selectedToken.status === 'ACTIVE' && (
                <>
                  <div className="border-t pt-4">
                    <Label className="text-muted-foreground">Estimated Fee</Label>
                    <p className="text-2xl font-bold">
                      {formatCurrency(selectedToken.estimatedFee || 0, currency)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      className="flex-1"
                      onClick={() => handleCompleteToken(selectedToken.id, 'CASH')}
                    >
                      Pay Cash
                    </Button>
                    <Button
                      className="flex-1"
                      variant="outline"
                      onClick={() => handleCompleteToken(selectedToken.id, 'UPI')}
                    >
                      Pay UPI
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
