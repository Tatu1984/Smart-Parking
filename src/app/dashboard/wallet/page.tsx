'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Wallet,
  CreditCard,
  ArrowUpRight,
  ArrowDownLeft,
  Send,
  QrCode,
  Plus,
  RefreshCw,
  Building2,
  TrendingUp,
  History,
  AlertCircle,
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils/currency'
import { cn } from '@/lib/utils'
import { useWalletUpdates } from '@/hooks/use-socket'

interface WalletData {
  id: string
  balance: number
  currency: string
  walletType: string
  status: string
  isVerified: boolean
  kycLevel: string
  dailyLimit: number
  monthlyLimit: number
  singleTxnLimit: number
  bankAccounts: {
    id: string
    bankName: string
    accountNumberLast4: string
    accountType: string
    status: string
    isPrimary: boolean
    isSandbox: boolean
  }[]
  sandboxConfig: {
    testBankBalance: number
  } | null
}

interface Transaction {
  id: string
  amount: number
  txnType: string
  status: string
  description: string
  direction: 'IN' | 'OUT'
  createdAt: string
  referenceId: string
}

export default function WalletPage() {
  const [wallets, setWallets] = useState<WalletData[]>([])
  const [selectedWallet, setSelectedWallet] = useState<WalletData | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [depositOpen, setDepositOpen] = useState(false)
  const [withdrawOpen, setWithdrawOpen] = useState(false)
  const [transferOpen, setTransferOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [processing, setProcessing] = useState(false)

  // Real-time balance updates
  const { balance: liveBalance, connected } = useWalletUpdates(selectedWallet?.id)

  useEffect(() => {
    fetchWallets()
  }, [])

  useEffect(() => {
    if (selectedWallet) {
      fetchTransactions(selectedWallet.id)
    }
  }, [selectedWallet])

  // Update balance in real-time
  useEffect(() => {
    if (liveBalance !== null && selectedWallet) {
      setSelectedWallet((prev) => prev ? { ...prev, balance: liveBalance } : null)
    }
  }, [liveBalance])

  const fetchWallets = async () => {
    try {
      const res = await fetch('/api/wallet')
      const data = await res.json()
      if (data.success) {
        setWallets(data.data)
        if (data.data.length > 0 && !selectedWallet) {
          setSelectedWallet(data.data[0])
        }
      }
    } catch (error) {
      console.error('Failed to fetch wallets:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchTransactions = async (walletId: string) => {
    try {
      const res = await fetch(`/api/wallet/${walletId}/transactions?limit=10`)
      const data = await res.json()
      if (data.success) {
        setTransactions(data.data)
      }
    } catch (error) {
      console.error('Failed to fetch transactions:', error)
    }
  }

  const createWallet = async (walletType: string, isSandbox: boolean) => {
    try {
      setProcessing(true)
      const res = await fetch('/api/wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletType, isSandbox }),
      })
      const data = await res.json()
      if (data.success) {
        fetchWallets()
      }
    } catch (error) {
      console.error('Failed to create wallet:', error)
    } finally {
      setProcessing(false)
    }
  }

  const handleDeposit = async () => {
    if (!selectedWallet || !amount) return

    const primaryBank = selectedWallet.bankAccounts.find((b) => b.isPrimary && b.status === 'VERIFIED')
    if (!primaryBank) {
      alert('No verified bank account found. Please add a bank account first.')
      return
    }

    try {
      setProcessing(true)
      const res = await fetch('/api/payments/deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletId: selectedWallet.id,
          bankAccountId: primaryBank.id,
          amount: parseFloat(amount) * 100, // Convert to paise
        }),
      })
      const data = await res.json()
      if (data.success) {
        setDepositOpen(false)
        setAmount('')
        fetchWallets()
        fetchTransactions(selectedWallet.id)
      } else {
        alert(data.error)
      }
    } catch (error) {
      console.error('Deposit failed:', error)
    } finally {
      setProcessing(false)
    }
  }

  const handleWithdraw = async () => {
    if (!selectedWallet || !amount) return

    const primaryBank = selectedWallet.bankAccounts.find((b) => b.isPrimary && b.status === 'VERIFIED')
    if (!primaryBank) {
      alert('No verified bank account found.')
      return
    }

    try {
      setProcessing(true)
      const res = await fetch('/api/payments/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletId: selectedWallet.id,
          bankAccountId: primaryBank.id,
          amount: parseFloat(amount) * 100,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setWithdrawOpen(false)
        setAmount('')
        fetchWallets()
        fetchTransactions(selectedWallet.id)
      } else {
        alert(data.error)
      }
    } catch (error) {
      console.error('Withdrawal failed:', error)
    } finally {
      setProcessing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Wallet</h1>
          <p className="text-muted-foreground">
            Manage your funds and transactions
          </p>
        </div>
        <div className="flex items-center gap-2">
          {connected && (
            <Badge variant="outline" className="gap-1">
              <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              Live
            </Badge>
          )}
          <Button variant="outline" onClick={fetchWallets}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Dialog>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Wallet
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Wallet</DialogTitle>
                <DialogDescription>
                  Choose the type of wallet to create
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <Button
                  variant="outline"
                  className="justify-start h-auto py-4"
                  onClick={() => createWallet('PERSONAL', false)}
                  disabled={processing}
                >
                  <Wallet className="h-5 w-5 mr-3" />
                  <div className="text-left">
                    <p className="font-medium">Personal Wallet</p>
                    <p className="text-sm text-muted-foreground">For personal use</p>
                  </div>
                </Button>
                <Button
                  variant="outline"
                  className="justify-start h-auto py-4"
                  onClick={() => createWallet('PERSONAL', true)}
                  disabled={processing}
                >
                  <AlertCircle className="h-5 w-5 mr-3 text-orange-500" />
                  <div className="text-left">
                    <p className="font-medium">Sandbox Wallet</p>
                    <p className="text-sm text-muted-foreground">For testing with fake money</p>
                  </div>
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {wallets.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Wallet className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No wallets yet</h3>
            <p className="text-muted-foreground mb-4">Create a wallet to start managing your funds</p>
            <Button onClick={() => createWallet('PERSONAL', true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Sandbox Wallet
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Wallet Selector */}
          <div className="space-y-4">
            {wallets.map((wallet) => (
              <Card
                key={wallet.id}
                className={cn(
                  'cursor-pointer transition-colors hover:border-primary/50',
                  selectedWallet?.id === wallet.id && 'border-primary'
                )}
                onClick={() => setSelectedWallet(wallet)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'flex h-10 w-10 items-center justify-center rounded-full',
                        wallet.sandboxConfig ? 'bg-orange-500/10' : 'bg-blue-500/10'
                      )}>
                        <Wallet className={cn(
                          'h-5 w-5',
                          wallet.sandboxConfig ? 'text-orange-500' : 'text-blue-500'
                        )} />
                      </div>
                      <div>
                        <p className="font-medium">{wallet.walletType} Wallet</p>
                        <p className="text-2xl font-bold">
                          {formatCurrency(wallet.balance / 100, wallet.currency)}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge variant={wallet.status === 'ACTIVE' ? 'default' : 'secondary'}>
                        {wallet.status}
                      </Badge>
                      {wallet.sandboxConfig && (
                        <Badge variant="outline" className="text-orange-500 border-orange-500/50">
                          Sandbox
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {selectedWallet && (
              <>
                {/* Quick Actions */}
                <Card>
                  <CardHeader>
                    <CardTitle>Quick Actions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <Dialog open={depositOpen} onOpenChange={setDepositOpen}>
                        <DialogTrigger asChild>
                          <Button variant="outline" className="h-auto py-4 flex-col">
                            <ArrowDownLeft className="h-6 w-6 mb-2 text-green-500" />
                            <span>Add Money</span>
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Add Money to Wallet</DialogTitle>
                            <DialogDescription>
                              Transfer money from your linked bank account
                            </DialogDescription>
                          </DialogHeader>
                          <div className="py-4">
                            <Label>Amount ({selectedWallet.currency})</Label>
                            <Input
                              type="number"
                              placeholder="0.00"
                              value={amount}
                              onChange={(e) => setAmount(e.target.value)}
                              className="mt-2"
                            />
                          </div>
                          <DialogFooter>
                            <Button onClick={handleDeposit} disabled={processing || !amount}>
                              {processing ? 'Processing...' : 'Add Money'}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>

                      <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
                        <DialogTrigger asChild>
                          <Button variant="outline" className="h-auto py-4 flex-col">
                            <ArrowUpRight className="h-6 w-6 mb-2 text-blue-500" />
                            <span>Withdraw</span>
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Withdraw to Bank</DialogTitle>
                            <DialogDescription>
                              Transfer money to your linked bank account
                            </DialogDescription>
                          </DialogHeader>
                          <div className="py-4">
                            <Label>Amount ({selectedWallet.currency})</Label>
                            <Input
                              type="number"
                              placeholder="0.00"
                              value={amount}
                              onChange={(e) => setAmount(e.target.value)}
                              className="mt-2"
                            />
                            <p className="text-sm text-muted-foreground mt-2">
                              Available: {formatCurrency(selectedWallet.balance / 100, selectedWallet.currency)}
                            </p>
                          </div>
                          <DialogFooter>
                            <Button onClick={handleWithdraw} disabled={processing || !amount}>
                              {processing ? 'Processing...' : 'Withdraw'}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>

                      <Button variant="outline" className="h-auto py-4 flex-col" asChild>
                        <a href="/dashboard/wallet/transfer">
                          <Send className="h-6 w-6 mb-2 text-purple-500" />
                          <span>Send</span>
                        </a>
                      </Button>

                      <Button variant="outline" className="h-auto py-4 flex-col" asChild>
                        <a href="/dashboard/wallet/request">
                          <QrCode className="h-6 w-6 mb-2 text-orange-500" />
                          <span>Request</span>
                        </a>
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Bank Accounts */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle>Linked Bank Accounts</CardTitle>
                      <CardDescription>Manage your connected bank accounts</CardDescription>
                    </div>
                    <Button variant="outline" size="sm" asChild>
                      <a href="/dashboard/wallet/bank-accounts">
                        <Building2 className="h-4 w-4 mr-2" />
                        Manage
                      </a>
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {selectedWallet.bankAccounts.length === 0 ? (
                      <div className="text-center py-8">
                        <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <p className="text-muted-foreground">No bank accounts linked</p>
                        <Button variant="outline" className="mt-4" asChild>
                          <a href="/dashboard/wallet/bank-accounts">Link Bank Account</a>
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {selectedWallet.bankAccounts.map((account) => (
                          <div
                            key={account.id}
                            className="flex items-center justify-between p-3 rounded-lg border"
                          >
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                                <CreditCard className="h-5 w-5" />
                              </div>
                              <div>
                                <p className="font-medium">{account.bankName}</p>
                                <p className="text-sm text-muted-foreground">
                                  ****{account.accountNumberLast4} • {account.accountType}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {account.isPrimary && (
                                <Badge variant="secondary">Primary</Badge>
                              )}
                              {account.isSandbox && (
                                <Badge variant="outline" className="text-orange-500">Sandbox</Badge>
                              )}
                              <Badge variant={account.status === 'VERIFIED' ? 'default' : 'secondary'}>
                                {account.status}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Recent Transactions */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle>Recent Transactions</CardTitle>
                      <CardDescription>Your latest wallet activity</CardDescription>
                    </div>
                    <Button variant="outline" size="sm" asChild>
                      <a href="/dashboard/wallet/transactions">
                        <History className="h-4 w-4 mr-2" />
                        View All
                      </a>
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {transactions.length === 0 ? (
                      <div className="text-center py-8">
                        <History className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <p className="text-muted-foreground">No transactions yet</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {transactions.map((txn) => (
                          <div
                            key={txn.id}
                            className="flex items-center justify-between p-3 rounded-lg border"
                          >
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                'flex h-10 w-10 items-center justify-center rounded-full',
                                txn.direction === 'IN'
                                  ? 'bg-green-500/10'
                                  : 'bg-red-500/10'
                              )}>
                                {txn.direction === 'IN' ? (
                                  <ArrowDownLeft className="h-5 w-5 text-green-500" />
                                ) : (
                                  <ArrowUpRight className="h-5 w-5 text-red-500" />
                                )}
                              </div>
                              <div>
                                <p className="font-medium">{txn.description}</p>
                                <p className="text-sm text-muted-foreground">
                                  {new Date(txn.createdAt).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className={cn(
                                'font-medium',
                                txn.direction === 'IN' ? 'text-green-500' : 'text-red-500'
                              )}>
                                {txn.direction === 'IN' ? '+' : '-'}
                                {formatCurrency(txn.amount / 100, selectedWallet.currency)}
                              </p>
                              <Badge variant={txn.status === 'COMPLETED' ? 'default' : 'secondary'} className="text-xs">
                                {txn.status}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
