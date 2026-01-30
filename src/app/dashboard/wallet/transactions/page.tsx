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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  ArrowLeft,
  ArrowUpRight,
  ArrowDownLeft,
  Search,
  Download,
  RefreshCw,
  Filter,
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils/currency'
import { cn } from '@/lib/utils'
import Link from 'next/link'

interface WalletData {
  id: string
  currency: string
  walletType: string
}

interface Transaction {
  id: string
  amount: number
  fee: number
  txnType: string
  status: string
  description: string
  direction: 'IN' | 'OUT'
  displayAmount: number
  referenceId: string
  createdAt: string
  completedAt: string | null
  senderWallet: { id: string; walletType: string } | null
  receiverWallet: { id: string; walletType: string } | null
  bankAccount: { bankName: string; accountNumberLast4: string } | null
}

export default function WalletTransactionsPage() {
  const [wallets, setWallets] = useState<WalletData[]>([])
  const [selectedWalletId, setSelectedWalletId] = useState('')
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [filterType, setFilterType] = useState<string>('')
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    fetchWallets()
  }, [])

  useEffect(() => {
    if (selectedWalletId) {
      fetchTransactions()
    }
  }, [selectedWalletId, page, filterType, filterStatus])

  const fetchWallets = async () => {
    try {
      const res = await fetch('/api/wallet')
      const data = await res.json()
      if (data.success && data.data.length > 0) {
        setWallets(data.data)
        setSelectedWalletId(data.data[0].id)
      }
    } catch (error) {
      logger.error('Failed to fetch wallets:', error instanceof Error ? error : undefined)
    }
  }

  const fetchTransactions = async () => {
    if (!selectedWalletId) return

    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
      })

      if (filterType) params.set('type', filterType)
      if (filterStatus) params.set('status', filterStatus)

      const res = await fetch(`/api/wallet/${selectedWalletId}/transactions?${params}`)
      const data = await res.json()

      if (data.success) {
        setTransactions(data.data)
        setTotalPages(data.pagination.pages)
      }
    } catch (error) {
      logger.error('Failed to fetch transactions:', error instanceof Error ? error : undefined)
    } finally {
      setLoading(false)
    }
  }

  const selectedWallet = wallets.find((w) => w.id === selectedWalletId)

  const getTypeIcon = (direction: string) => {
    return direction === 'IN' ? (
      <ArrowDownLeft className="h-4 w-4 text-green-500" />
    ) : (
      <ArrowUpRight className="h-4 w-4 text-red-500" />
    )
  }

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      DEPOSIT: 'Deposit',
      WITHDRAWAL: 'Withdrawal',
      TRANSFER: 'Transfer',
      PAYMENT: 'Payment',
      REFUND: 'Refund',
      FEE: 'Fee',
    }
    return labels[type] || type
  }

  const exportTransactions = () => {
    // Create CSV content
    const headers = ['Date', 'Type', 'Description', 'Amount', 'Fee', 'Status', 'Reference']
    const rows = transactions.map((txn) => [
      new Date(txn.createdAt).toISOString(),
      getTypeLabel(txn.txnType),
      txn.description,
      txn.displayAmount / 100,
      txn.fee / 100,
      txn.status,
      txn.referenceId,
    ])

    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `transactions-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  const filteredTransactions = transactions.filter((txn) =>
    searchQuery
      ? txn.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        txn.referenceId.toLowerCase().includes(searchQuery.toLowerCase())
      : true
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/wallet">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Transactions</h1>
            <p className="text-muted-foreground">View your wallet transaction history</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={exportTransactions}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button variant="outline" onClick={fetchTransactions}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <Select value={selectedWalletId} onValueChange={setSelectedWalletId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select wallet" />
                </SelectTrigger>
                <SelectContent>
                  {wallets.map((wallet) => (
                    <SelectItem key={wallet.id} value={wallet.id}>
                      {wallet.walletType} Wallet
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="w-[150px]">
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger>
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Types</SelectItem>
                  <SelectItem value="DEPOSIT">Deposit</SelectItem>
                  <SelectItem value="WITHDRAWAL">Withdrawal</SelectItem>
                  <SelectItem value="TRANSFER">Transfer</SelectItem>
                  <SelectItem value="PAYMENT">Payment</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="w-[150px]">
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Statuses</SelectItem>
                  <SelectItem value="COMPLETED">Completed</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="FAILED">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search transactions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transactions Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64">
              <Filter className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No transactions found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Fee</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reference</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransactions.map((txn) => (
                  <TableRow key={txn.id}>
                    <TableCell className="whitespace-nowrap">
                      <div>
                        <p className="font-medium">
                          {new Date(txn.createdAt).toLocaleDateString()}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(txn.createdAt).toLocaleTimeString()}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getTypeIcon(txn.direction)}
                        <span>{getTypeLabel(txn.txnType)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {txn.description}
                      {txn.bankAccount && (
                        <p className="text-xs text-muted-foreground">
                          {txn.bankAccount.bankName} ****{txn.bankAccount.accountNumberLast4}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <span
                        className={cn(
                          'font-medium',
                          txn.direction === 'IN' ? 'text-green-500' : 'text-red-500'
                        )}
                      >
                        {txn.direction === 'IN' ? '+' : '-'}
                        {formatCurrency(txn.amount / 100, selectedWallet?.currency || 'INR')}
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {txn.fee > 0
                        ? formatCurrency(txn.fee / 100, selectedWallet?.currency || 'INR')
                        : '-'}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          txn.status === 'COMPLETED'
                            ? 'default'
                            : txn.status === 'PENDING'
                            ? 'secondary'
                            : 'destructive'
                        }
                      >
                        {txn.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs text-muted-foreground">{txn.referenceId}</code>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t">
            <p className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
