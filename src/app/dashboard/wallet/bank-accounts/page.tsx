'use client'

import { logger } from '@/lib/logger'
import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
import { Switch } from '@/components/ui/switch'
import {
  Building2,
  CreditCard,
  Plus,
  Star,
  Trash2,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  ArrowLeft,
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils/currency'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

interface BankAccount {
  id: string
  walletId: string
  bankName: string
  accountHolderName: string
  accountNumber?: string
  accountNumberLast4: string
  ifscCode: string
  accountType: string
  status: string
  isPrimary: boolean
  isSandbox: boolean
  sandboxBalance: number | null
  wallet: {
    id: string
    walletType: string
    currency: string
  }
}

interface Wallet {
  id: string
  walletType: string
  currency: string
  sandboxConfig: any
}

const SANDBOX_BANKS = [
  { ifsc: 'SBIN0000001', name: 'State Bank of India (Sandbox)' },
  { ifsc: 'HDFC0000001', name: 'HDFC Bank (Sandbox)' },
  { ifsc: 'ICIC0000001', name: 'ICICI Bank (Sandbox)' },
  { ifsc: 'AXIS0000001', name: 'Axis Bank (Sandbox)' },
  { ifsc: 'KKBK0000001', name: 'Kotak Mahindra Bank (Sandbox)' },
]

// Validation functions
function validateAccountNumber(value: string): string | null {
  if (!value) return 'Account number is required'
  const digits = value.replace(/\D/g, '')
  if (digits.length < 9 || digits.length > 18) {
    return 'Account number must be 9-18 digits'
  }
  return null
}

function validateIFSC(value: string): string | null {
  if (!value) return 'IFSC code is required'
  // IFSC format: 4 letters + 0 + 6 alphanumeric
  const ifscPattern = /^[A-Z]{4}0[A-Z0-9]{6}$/
  if (!ifscPattern.test(value.toUpperCase())) {
    return 'Invalid IFSC format (e.g., SBIN0001234)'
  }
  return null
}

export default function BankAccountsPage() {
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [wallets, setWallets] = useState<Wallet[]>([])
  const [loading, setLoading] = useState(true)
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Form state
  const [selectedWalletId, setSelectedWalletId] = useState('')
  const [accountHolderName, setAccountHolderName] = useState('')
  const [bankName, setBankName] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [ifscCode, setIfscCode] = useState('')
  const [accountType, setAccountType] = useState('SAVINGS')
  const [isSandbox, setIsSandbox] = useState(true)

  // Validation errors
  const [accountNumberError, setAccountNumberError] = useState<string | null>(null)
  const [ifscError, setIfscError] = useState<string | null>(null)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [accountsRes, walletsRes] = await Promise.all([
        fetch('/api/bank-accounts'),
        fetch('/api/wallet'),
      ])

      const accountsData = await accountsRes.json()
      const walletsData = await walletsRes.json()

      if (accountsData.success) {
        setBankAccounts(accountsData.data)
      }
      if (walletsData.success) {
        setWallets(walletsData.data)
        if (walletsData.data.length > 0 && !selectedWalletId) {
          setSelectedWalletId(walletsData.data[0].id)
        }
      }
    } catch (error) {
      logger.error('Failed to fetch data:', error instanceof Error ? error : undefined)
    } finally {
      setLoading(false)
    }
  }

  const handleAddAccount = async () => {
    // Validate fields
    const accError = validateAccountNumber(accountNumber)
    const ifscErr = isSandbox ? null : validateIFSC(ifscCode)

    setAccountNumberError(accError)
    setIfscError(ifscErr)

    if (accError || ifscErr) {
      return
    }

    if (!selectedWalletId || !accountHolderName) {
      toast.error('Please fill all required fields')
      return
    }

    try {
      setProcessing(true)
      const res = await fetch('/api/bank-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletId: selectedWalletId,
          accountHolderName,
          bankName,
          accountNumber,
          ifscCode,
          accountType,
          isSandbox,
        }),
      })

      const data = await res.json()
      if (data.success) {
        toast.success('Bank account added successfully')
        setAddDialogOpen(false)
        resetForm()
        fetchData()
      } else {
        toast.error(data.error || 'Failed to add bank account')
      }
    } catch (error) {
      logger.error('Failed to add bank account:', error instanceof Error ? error : undefined)
      toast.error('Failed to add bank account')
    } finally {
      setProcessing(false)
    }
  }

  const handleSetPrimary = async (accountId: string) => {
    try {
      const res = await fetch(`/api/bank-accounts/${accountId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPrimary: true }),
      })

      if (res.ok) {
        toast.success('Primary account updated')
        fetchData()
      } else {
        toast.error('Failed to set primary account')
      }
    } catch (error) {
      logger.error('Failed to set primary:', error instanceof Error ? error : undefined)
      toast.error('Failed to set primary account')
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    setDeleting(true)

    try {
      const res = await fetch(`/api/bank-accounts/${deleteId}`, {
        method: 'DELETE',
      })

      const data = await res.json()
      if (data.success) {
        toast.success('Bank account removed')
        setDeleteId(null)
        fetchData()
      } else {
        toast.error(data.error || 'Failed to remove bank account')
      }
    } catch (error) {
      logger.error('Failed to delete account:', error instanceof Error ? error : undefined)
      toast.error('Failed to remove bank account')
    } finally {
      setDeleting(false)
    }
  }

  const resetForm = () => {
    setAccountHolderName('')
    setBankName('')
    setAccountNumber('')
    setIfscCode('')
    setAccountType('SAVINGS')
    setIsSandbox(true)
    setAccountNumberError(null)
    setIfscError(null)
  }

  const handleSandboxBankSelect = (ifsc: string) => {
    const bank = SANDBOX_BANKS.find((b) => b.ifsc === ifsc)
    if (bank) {
      setIfscCode(ifsc)
      setBankName(bank.name)
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
        <div className="flex items-center gap-4">
          <Link href="/dashboard/wallet">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Bank Accounts</h1>
            <p className="text-muted-foreground">
              Manage your linked bank accounts
            </p>
          </div>
        </div>
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Bank Account
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Link Bank Account</DialogTitle>
              <DialogDescription>
                Add a new bank account to your wallet
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Wallet</Label>
                <Select value={selectedWalletId} onValueChange={setSelectedWalletId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select wallet" />
                  </SelectTrigger>
                  <SelectContent>
                    {wallets.map((wallet) => (
                      <SelectItem key={wallet.id} value={wallet.id}>
                        {wallet.walletType} Wallet {wallet.sandboxConfig && '(Sandbox)'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <Label>Sandbox Mode</Label>
                <Switch checked={isSandbox} onCheckedChange={setIsSandbox} />
              </div>

              {isSandbox && (
                <div className="space-y-2">
                  <Label>Select Sandbox Bank</Label>
                  <Select onValueChange={handleSandboxBankSelect}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a test bank" />
                    </SelectTrigger>
                    <SelectContent>
                      {SANDBOX_BANKS.map((bank) => (
                        <SelectItem key={bank.ifsc} value={bank.ifsc}>
                          {bank.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label>Account Holder Name</Label>
                <Input
                  value={accountHolderName}
                  onChange={(e) => setAccountHolderName(e.target.value)}
                  placeholder="John Doe"
                />
              </div>

              <div className="space-y-2">
                <Label>Account Number</Label>
                <Input
                  value={accountNumber}
                  onChange={(e) => {
                    setAccountNumber(e.target.value)
                    setAccountNumberError(null)
                  }}
                  onBlur={() => setAccountNumberError(validateAccountNumber(accountNumber))}
                  placeholder={isSandbox ? '1234567890123456' : 'Enter account number'}
                  className={accountNumberError ? 'border-red-500 focus-visible:ring-red-500' : ''}
                />
                {accountNumberError && (
                  <p className="text-sm text-red-500">{accountNumberError}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>IFSC Code</Label>
                <Input
                  value={ifscCode}
                  onChange={(e) => {
                    setIfscCode(e.target.value.toUpperCase())
                    setIfscError(null)
                  }}
                  onBlur={() => !isSandbox && setIfscError(validateIFSC(ifscCode))}
                  placeholder="SBIN0000001"
                  disabled={isSandbox && !!ifscCode}
                  className={ifscError ? 'border-red-500 focus-visible:ring-red-500' : ''}
                />
                {ifscError && (
                  <p className="text-sm text-red-500">{ifscError}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Account Type</Label>
                <Select value={accountType} onValueChange={setAccountType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SAVINGS">Savings</SelectItem>
                    <SelectItem value="CURRENT">Current</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddAccount} disabled={processing}>
                {processing ? 'Adding...' : 'Add Account'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Bank Accounts List */}
      {bankAccounts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Building2 className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No bank accounts linked</h3>
            <p className="text-muted-foreground mb-4">
              Link a bank account to add money or withdraw funds
            </p>
            <Button onClick={() => setAddDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Bank Account
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {bankAccounts.map((account) => (
            <Card key={account.id}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'flex h-12 w-12 items-center justify-center rounded-full',
                      account.isSandbox ? 'bg-orange-500/10' : 'bg-blue-500/10'
                    )}>
                      <CreditCard className={cn(
                        'h-6 w-6',
                        account.isSandbox ? 'text-orange-500' : 'text-blue-500'
                      )} />
                    </div>
                    <div>
                      <p className="font-medium">{account.bankName}</p>
                      <p className="text-sm text-muted-foreground">
                        {account.accountHolderName}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {account.isPrimary && (
                      <Badge className="gap-1">
                        <Star className="h-3 w-3" />
                        Primary
                      </Badge>
                    )}
                    <Badge variant={account.status === 'VERIFIED' ? 'default' : 'secondary'}>
                      {account.status === 'VERIFIED' ? (
                        <CheckCircle className="h-3 w-3 mr-1" />
                      ) : (
                        <AlertCircle className="h-3 w-3 mr-1" />
                      )}
                      {account.status}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Account Number</span>
                    <span className="font-mono">****{account.accountNumberLast4}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">IFSC Code</span>
                    <span className="font-mono">{account.ifscCode}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Type</span>
                    <span>{account.accountType}</span>
                  </div>
                  {account.isSandbox && account.sandboxBalance !== null && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Sandbox Balance</span>
                      <span className="font-medium text-green-500">
                        {formatCurrency(account.sandboxBalance / 100, account.wallet.currency)}
                      </span>
                    </div>
                  )}
                </div>

                {account.isSandbox && (
                  <div className="mb-4 p-2 rounded-lg bg-orange-500/10 text-orange-500 text-sm">
                    This is a sandbox bank account for testing purposes
                  </div>
                )}

                <div className="flex gap-2">
                  {!account.isPrimary && account.status === 'VERIFIED' && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => handleSetPrimary(account.id)}
                    >
                      <Star className="h-4 w-4 mr-2" />
                      Set Primary
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-500 hover:text-red-500"
                    onClick={() => setDeleteId(account.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Remove Bank Account"
        description="Are you sure you want to remove this bank account? This action cannot be undone."
        confirmText="Remove"
        variant="destructive"
        onConfirm={handleDelete}
        loading={deleting}
      />
    </div>
  )
}
