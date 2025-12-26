'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, QrCode, Link as LinkIcon, Mail, Copy, Check, Wallet } from 'lucide-react'
import { formatCurrency } from '@/lib/utils/currency'
import Link from 'next/link'

interface WalletData {
  id: string
  balance: number
  currency: string
  walletType: string
  sandboxConfig: any
}

interface PaymentRequest {
  id: string
  paymentRef: string
  amount: number
  description: string
  status: string
  qrCode: string | null
  paymentUrl: string
  expiresAt: string
  createdAt: string
}

export default function RequestPaymentPage() {
  const [wallets, setWallets] = useState<WalletData[]>([])
  const [requests, setRequests] = useState<PaymentRequest[]>([])
  const [selectedWalletId, setSelectedWalletId] = useState('')
  const [recipientEmail, setRecipientEmail] = useState('')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [processing, setProcessing] = useState(false)
  const [createdRequest, setCreatedRequest] = useState<PaymentRequest | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetchWallets()
    fetchRequests()
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
      console.error('Failed to fetch wallets:', error)
    }
  }

  const fetchRequests = async () => {
    try {
      const res = await fetch('/api/payments/request?type=sent')
      const data = await res.json()
      if (data.success) {
        setRequests(data.data)
      }
    } catch (error) {
      console.error('Failed to fetch requests:', error)
    }
  }

  const selectedWallet = wallets.find((w) => w.id === selectedWalletId)

  const handleCreateRequest = async () => {
    if (!selectedWalletId || !amount) {
      return
    }

    try {
      setProcessing(true)

      const res = await fetch('/api/payments/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletId: selectedWalletId,
          payerEmail: recipientEmail || undefined,
          amount: parseFloat(amount) * 100,
          description: description || `Payment request for ${formatCurrency(parseFloat(amount), selectedWallet?.currency || 'INR')}`,
          paymentType: recipientEmail ? 'REQUEST' : 'QR_CODE',
        }),
      })

      const data = await res.json()
      if (data.success) {
        setCreatedRequest(data.data)
        fetchRequests()
      } else {
        alert(data.error)
      }
    } catch (error) {
      console.error('Failed to create request:', error)
    } finally {
      setProcessing(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const resetForm = () => {
    setAmount('')
    setDescription('')
    setRecipientEmail('')
    setCreatedRequest(null)
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/wallet">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Request Payment</h1>
          <p className="text-muted-foreground">Create a payment request or QR code</p>
        </div>
      </div>

      <Tabs defaultValue="create">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="create">Create Request</TabsTrigger>
          <TabsTrigger value="history">Request History</TabsTrigger>
        </TabsList>

        <TabsContent value="create" className="mt-4">
          {createdRequest ? (
            <Card>
              <CardHeader className="text-center">
                <CardTitle className="text-green-500">Payment Request Created!</CardTitle>
                <CardDescription>Share this with the payer</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {createdRequest.qrCode && (
                  <div className="flex justify-center">
                    <img
                      src={createdRequest.qrCode}
                      alt="Payment QR Code"
                      className="w-64 h-64 border rounded-lg"
                    />
                  </div>
                )}

                <div className="text-center">
                  <p className="text-2xl font-bold">
                    {formatCurrency(createdRequest.amount / 100, selectedWallet?.currency || 'INR')}
                  </p>
                  {createdRequest.description && (
                    <p className="text-muted-foreground">{createdRequest.description}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Payment Link</Label>
                  <div className="flex gap-2">
                    <Input
                      value={createdRequest.paymentUrl}
                      readOnly
                      className="font-mono text-sm"
                    />
                    <Button
                      variant="outline"
                      onClick={() => copyToClipboard(createdRequest.paymentUrl)}
                    >
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <div className="text-center text-sm text-muted-foreground">
                  Expires: {new Date(createdRequest.expiresAt).toLocaleDateString()}
                </div>

                <div className="flex gap-4">
                  <Button variant="outline" className="flex-1" onClick={resetForm}>
                    Create Another
                  </Button>
                  <Button className="flex-1" asChild>
                    <Link href="/dashboard/wallet">Done</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <QrCode className="h-5 w-5" />
                  Request Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* To Wallet */}
                <div className="space-y-2">
                  <Label>Receive To</Label>
                  <Select value={selectedWalletId} onValueChange={setSelectedWalletId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select wallet" />
                    </SelectTrigger>
                    <SelectContent>
                      {wallets.map((wallet) => (
                        <SelectItem key={wallet.id} value={wallet.id}>
                          {wallet.walletType} Wallet
                          {wallet.sandboxConfig && ' (Sandbox)'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Recipient Email (optional) */}
                <div className="space-y-2">
                  <Label>From (Optional)</Label>
                  <Input
                    type="email"
                    placeholder="payer@example.com"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                  />
                  <p className="text-sm text-muted-foreground">
                    Leave empty to create a QR code anyone can pay
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

                {/* Description */}
                <div className="space-y-2">
                  <Label>Description (Optional)</Label>
                  <Textarea
                    placeholder="What is this payment for?"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
                  />
                </div>

                <Button
                  className="w-full"
                  size="lg"
                  onClick={handleCreateRequest}
                  disabled={processing || !amount}
                >
                  {processing ? 'Creating...' : 'Create Request'}
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Your Payment Requests</CardTitle>
              <CardDescription>Track the status of your requests</CardDescription>
            </CardHeader>
            <CardContent>
              {requests.length === 0 ? (
                <div className="text-center py-8">
                  <QrCode className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No payment requests yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {requests.map((request) => (
                    <div
                      key={request.id}
                      className="flex items-center justify-between p-4 rounded-lg border"
                    >
                      <div>
                        <p className="font-medium">
                          {formatCurrency(request.amount / 100, selectedWallet?.currency || 'INR')}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {request.description || 'Payment request'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(request.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            request.status === 'COMPLETED'
                              ? 'default'
                              : request.status === 'EXPIRED'
                              ? 'destructive'
                              : 'secondary'
                          }
                        >
                          {request.status}
                        </Badge>
                        {request.status === 'PENDING' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => copyToClipboard(request.paymentUrl)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
