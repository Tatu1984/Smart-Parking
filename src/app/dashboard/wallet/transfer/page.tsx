'use client'

import { logger } from '@/lib/logger'
import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Send, CheckCircle, Wallet } from 'lucide-react'
import { formatCurrency } from '@/lib/utils/currency'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface WalletData {
  id: string
  balance: number
  currency: string
  walletType: string
  sandboxConfig: any
}

export default function TransferPage() {
  const router = useRouter()
  const [wallets, setWallets] = useState<WalletData[]>([])
  const [selectedWalletId, setSelectedWalletId] = useState('')
  const [recipientEmail, setRecipientEmail] = useState('')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [processing, setProcessing] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchWallets()
  }, [])

  const fetchWallets = async () => {
    try {
      const res = await fetch('/api/wallet')
      const data = await res.json()
      if (data.success) {
        setWallets(data.data)
        if (data.data.length > 0) {
          setSelectedWalletId(data.data[0].id)
        }
      }
    } catch (error) {
      logger.error('Failed to fetch wallets:', error instanceof Error ? error : undefined)
    }
  }

  const selectedWallet = wallets.find((w) => w.id === selectedWalletId)

  const handleTransfer = async () => {
    if (!selectedWalletId || !recipientEmail || !amount) {
      setError('Please fill all required fields')
      return
    }

    const amountInPaise = parseFloat(amount) * 100
    if (selectedWallet && amountInPaise > selectedWallet.balance) {
      setError('Insufficient balance')
      return
    }

    try {
      setProcessing(true)
      setError('')

      const res = await fetch('/api/payments/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromWalletId: selectedWalletId,
          toEmail: recipientEmail,
          amount: amountInPaise,
          description: `Transfer to ${recipientEmail}`,
          note,
        }),
      })

      const data = await res.json()
      if (data.success) {
        setSuccess(true)
        setTimeout(() => {
          router.push('/dashboard/wallet')
        }, 2000)
      } else {
        setError(data.error)
      }
    } catch (error) {
      logger.error('Transfer failed:', error instanceof Error ? error : undefined)
      setError('Transfer failed. Please try again.')
    } finally {
      setProcessing(false)
    }
  }

  if (success) {
    return (
      <div className="max-w-md mx-auto mt-20">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-500/10 mb-6">
              <CheckCircle className="h-10 w-10 text-green-500" />
            </div>
            <h3 className="text-xl font-medium mb-2">Transfer Successful!</h3>
            <p className="text-muted-foreground text-center">
              {formatCurrency(parseFloat(amount), selectedWallet?.currency || 'INR')} sent to {recipientEmail}
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/wallet">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Send Money</h1>
          <p className="text-muted-foreground">Transfer funds to another wallet</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Transfer Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* From Wallet */}
          <div className="space-y-2">
            <Label>From Wallet</Label>
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
                {selectedWallet.sandboxConfig && (
                  <Badge variant="outline" className="ml-2 text-orange-500">Sandbox</Badge>
                )}
              </p>
            )}
          </div>

          {/* Recipient */}
          <div className="space-y-2">
            <Label>Recipient Email</Label>
            <Input
              type="email"
              placeholder="recipient@example.com"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
            />
            <p className="text-sm text-muted-foreground">
              Enter the email address of the recipient
            </p>
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <Label>Amount ({selectedWallet?.currency || 'INR'})</Label>
            <Input
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="text-2xl font-bold h-14"
            />
          </div>

          {/* Note */}
          <div className="space-y-2">
            <Label>Note (Optional)</Label>
            <Textarea
              placeholder="Add a note for the recipient"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
            />
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 text-red-500 text-sm">
              {error}
            </div>
          )}

          {/* Summary */}
          {amount && parseFloat(amount) > 0 && (
            <div className="p-4 rounded-lg bg-muted">
              <h4 className="font-medium mb-2">Transfer Summary</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount</span>
                  <span>{formatCurrency(parseFloat(amount), selectedWallet?.currency || 'INR')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fee</span>
                  <span className="text-green-500">Free</span>
                </div>
                <div className="flex justify-between font-medium pt-2 border-t">
                  <span>Total</span>
                  <span>{formatCurrency(parseFloat(amount), selectedWallet?.currency || 'INR')}</span>
                </div>
              </div>
            </div>
          )}

          <Button
            className="w-full"
            size="lg"
            onClick={handleTransfer}
            disabled={processing || !amount || !recipientEmail}
          >
            {processing ? 'Processing...' : 'Send Money'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
