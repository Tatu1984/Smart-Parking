'use client'

import { useState, useEffect, use } from 'react'
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
  Wallet,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  LogIn,
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils/currency'
import { cn } from '@/lib/utils'
import Link from 'next/link'

interface PaymentRequest {
  id: string
  paymentRef: string
  amount: number
  description: string
  status: string
  expiresAt: string
  payeeWallet: {
    id: string
    walletType: string
    userId: string
  }
}

interface WalletData {
  id: string
  balance: number
  currency: string
  walletType: string
}

export default function PaymentPage({ params }: { params: Promise<{ ref: string }> }) {
  const resolvedParams = use(params)
  const [payment, setPayment] = useState<PaymentRequest | null>(null)
  const [wallets, setWallets] = useState<WalletData[]>([])
  const [selectedWalletId, setSelectedWalletId] = useState('')
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [result, setResult] = useState<'success' | 'error' | null>(null)
  const [error, setError] = useState('')
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  useEffect(() => {
    fetchPayment()
    checkAuth()
  }, [resolvedParams.ref])

  const fetchPayment = async () => {
    try {
      const res = await fetch(`/api/payments/request/${resolvedParams.ref}`)
      const data = await res.json()
      if (data.success) {
        setPayment(data.data)
      }
    } catch (error) {
      console.error('Failed to fetch payment:', error)
    } finally {
      setLoading(false)
    }
  }

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/wallet')
      const data = await res.json()
      if (data.success) {
        setIsLoggedIn(true)
        setWallets(data.data)
        if (data.data.length > 0) {
          setSelectedWalletId(data.data[0].id)
        }
      }
    } catch (error) {
      setIsLoggedIn(false)
    }
  }

  const handlePay = async () => {
    if (!payment || !selectedWalletId) return

    try {
      setProcessing(true)
      setError('')

      const res = await fetch(`/api/payments/request/${payment.id}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletId: selectedWalletId }),
      })

      const data = await res.json()
      if (data.success) {
        setResult('success')
      } else {
        setError(data.error)
        setResult('error')
      }
    } catch (error) {
      setError('Payment failed. Please try again.')
      setResult('error')
    } finally {
      setProcessing(false)
    }
  }

  const selectedWallet = wallets.find((w) => w.id === selectedWalletId)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    )
  }

  if (!payment) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <XCircle className="h-16 w-16 text-red-500 mb-4" />
            <h3 className="text-xl font-medium mb-2">Payment Not Found</h3>
            <p className="text-muted-foreground text-center">
              This payment link is invalid or has expired.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (payment.status !== 'PENDING') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="flex flex-col items-center justify-center py-16">
            {payment.status === 'COMPLETED' ? (
              <>
                <CheckCircle className="h-16 w-16 text-green-500 mb-4" />
                <h3 className="text-xl font-medium mb-2">Payment Completed</h3>
                <p className="text-muted-foreground text-center">
                  This payment has already been processed.
                </p>
              </>
            ) : (
              <>
                <Clock className="h-16 w-16 text-orange-500 mb-4" />
                <h3 className="text-xl font-medium mb-2">Payment Expired</h3>
                <p className="text-muted-foreground text-center">
                  This payment request has expired.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  if (result === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-500/10 mb-6">
              <CheckCircle className="h-10 w-10 text-green-500" />
            </div>
            <h3 className="text-xl font-medium mb-2">Payment Successful!</h3>
            <p className="text-3xl font-bold mb-2">
              {formatCurrency(payment.amount / 100, 'INR')}
            </p>
            <p className="text-muted-foreground text-center mb-6">
              Your payment has been processed successfully.
            </p>
            <Button asChild>
              <Link href="/dashboard/wallet">Go to Wallet</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mx-auto mb-4">
            <Wallet className="h-8 w-8 text-primary" />
          </div>
          <CardTitle>Payment Request</CardTitle>
          <CardDescription>
            {payment.description || 'You have received a payment request'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center">
            <p className="text-4xl font-bold">
              {formatCurrency(payment.amount / 100, 'INR')}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Expires: {new Date(payment.expiresAt).toLocaleDateString()}
            </p>
          </div>

          {!isLoggedIn ? (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-muted text-center">
                <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  Please log in to complete this payment
                </p>
              </div>
              <Button className="w-full" asChild>
                <Link href={`/login?redirect=/pay/${resolvedParams.ref}`}>
                  <LogIn className="h-4 w-4 mr-2" />
                  Log In to Pay
                </Link>
              </Button>
            </div>
          ) : wallets.length === 0 ? (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-muted text-center">
                <Wallet className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  You need a wallet to make payments
                </p>
              </div>
              <Button className="w-full" asChild>
                <Link href="/dashboard/wallet">
                  Create Wallet
                </Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Pay From</Label>
                <Select value={selectedWalletId} onValueChange={setSelectedWalletId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select wallet" />
                  </SelectTrigger>
                  <SelectContent>
                    {wallets.map((wallet) => (
                      <SelectItem key={wallet.id} value={wallet.id}>
                        <div className="flex items-center justify-between w-full">
                          <span>{wallet.walletType} Wallet</span>
                          <span className="ml-4 text-muted-foreground">
                            {formatCurrency(wallet.balance / 100, wallet.currency)}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedWallet && (
                  <p className="text-sm text-muted-foreground">
                    Available: {formatCurrency(selectedWallet.balance / 100, selectedWallet.currency)}
                  </p>
                )}
              </div>

              {selectedWallet && selectedWallet.balance < payment.amount && (
                <div className="p-3 rounded-lg bg-red-500/10 text-red-500 text-sm">
                  Insufficient balance in selected wallet
                </div>
              )}

              {error && (
                <div className="p-3 rounded-lg bg-red-500/10 text-red-500 text-sm">
                  {error}
                </div>
              )}

              <Button
                className="w-full"
                size="lg"
                onClick={handlePay}
                disabled={
                  processing ||
                  !selectedWallet ||
                  selectedWallet.balance < payment.amount
                }
              >
                {processing ? 'Processing...' : `Pay ${formatCurrency(payment.amount / 100, 'INR')}`}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
