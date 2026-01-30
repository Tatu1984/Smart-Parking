'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Building2,
  CreditCard,
  Bell,
  Shield,
  Palette,
  Save,
  RefreshCw,
} from 'lucide-react'
import { toast } from 'sonner'
import { getCurrencyOptions, getCountryOptions, countries } from '@/lib/utils/currency'

// Get all currency and country options
const currencyOptions = getCurrencyOptions()
const countryOptions = getCountryOptions()

interface Settings {
  organization: {
    name: string
    primaryColor: string
    secondaryColor: string
    defaultCurrency: string
    defaultTimezone: string
    anprEnabled: boolean
    evChargingEnabled: boolean
  }
  parkingLot: {
    name: string
    address: string
    city: string
    country: string
    currency: string
    timezone: string
    venueType: string
    operatingHours: Record<string, { open: string; close: string }> | null
    hasEvCharging: boolean
    hasValetService: boolean
  } | null
  features: {
    anprEnabled: boolean
    evChargingEnabled: boolean
    valetEnabled: boolean
    reservationEnabled: boolean
  }
  alerts: {
    highOccupancyAlert: boolean
    cameraOfflineAlert: boolean
    paymentFailureAlert: boolean
    dailyReport: boolean
    emailRecipients: string
    smsNumbers: string
    webhookUrl: string
  }
  security: {
    twoFactorEnabled: boolean
    sessionTimeout: string
    auditLogging: boolean
    licensePlateHashing: boolean
    transactionRetention: string
    videoRetention: string
  }
  display: {
    availableSlotsColor: string
    fullZoneColor: string
    showZoneNames: boolean
    showDirectionalArrows: boolean
    autoRefresh: boolean
    compactView: boolean
    soundAlerts: boolean
  }
  pricing: {
    pricingModel: string
    baseRate: number
    hourlyRate: number
    dailyMaximum: number
    lostTicketFee: number
    applyGst: boolean
    gstNumber: string
    taxRate: number
  }
}

const defaultSettings: Settings = {
  organization: {
    name: '',
    primaryColor: '#1E3A5F',
    secondaryColor: '#3182CE',
    defaultCurrency: 'INR',
    defaultTimezone: 'Asia/Kolkata',
    anprEnabled: false,
    evChargingEnabled: false,
  },
  parkingLot: {
    name: '',
    address: '',
    city: '',
    country: 'India',
    currency: 'INR',
    timezone: 'Asia/Kolkata',
    venueType: 'MALL',
    operatingHours: null,
    hasEvCharging: false,
    hasValetService: false,
  },
  features: {
    anprEnabled: false,
    evChargingEnabled: false,
    valetEnabled: false,
    reservationEnabled: true,
  },
  alerts: {
    highOccupancyAlert: true,
    cameraOfflineAlert: true,
    paymentFailureAlert: true,
    dailyReport: true,
    emailRecipients: '',
    smsNumbers: '',
    webhookUrl: '',
  },
  security: {
    twoFactorEnabled: false,
    sessionTimeout: '8h',
    auditLogging: true,
    licensePlateHashing: false,
    transactionRetention: '2y',
    videoRetention: '30d',
  },
  display: {
    availableSlotsColor: '#22c55e',
    fullZoneColor: '#ef4444',
    showZoneNames: true,
    showDirectionalArrows: true,
    autoRefresh: true,
    compactView: false,
    soundAlerts: false,
  },
  pricing: {
    pricingModel: 'hourly',
    baseRate: 50,
    hourlyRate: 30,
    dailyMaximum: 300,
    lostTicketFee: 500,
    applyGst: true,
    gstNumber: '',
    taxRate: 18,
  },
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>(defaultSettings)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [is24_7, setIs24_7] = useState(true)

  const fetchSettings = useCallback(async () => {
    try {
      const response = await fetch('/api/settings')
      if (response.ok) {
        const data = await response.json()
        if (data.data) {
          setSettings(data.data)
        }
      }
    } catch (error) {
      toast.error('Failed to load settings')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  const handleSave = async () => {
    setSaving(true)
    try {
      const response = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      if (response.ok) {
        toast.success('Settings saved successfully')
      } else {
        const error = await response.json()
        toast.error(error.message || 'Failed to save settings')
      }
    } catch (error) {
      toast.error('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const updateSettings = <K extends keyof Settings>(
    section: K,
    key: string,
    value: unknown
  ) => {
    setSettings((prev) => ({
      ...prev,
      [section]: {
        ...(prev[section] as Record<string, unknown>),
        [key]: value,
      },
    }))
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-9 w-48 mb-2" />
            <Skeleton className="h-5 w-72" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        <Skeleton className="h-10 w-full max-w-md" />
        <div className="space-y-6">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">
            Manage your parking lot configuration and preferences
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save Changes
        </Button>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:grid-cols-none">
          <TabsTrigger value="general" className="gap-2">
            <Building2 className="h-4 w-4" />
            <span className="hidden sm:inline">General</span>
          </TabsTrigger>
          <TabsTrigger value="pricing" className="gap-2">
            <CreditCard className="h-4 w-4" />
            <span className="hidden sm:inline">Pricing</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="h-4 w-4" />
            <span className="hidden sm:inline">Alerts</span>
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2">
            <Shield className="h-4 w-4" />
            <span className="hidden sm:inline">Security</span>
          </TabsTrigger>
          <TabsTrigger value="appearance" className="gap-2">
            <Palette className="h-4 w-4" />
            <span className="hidden sm:inline">Display</span>
          </TabsTrigger>
        </TabsList>

        {/* General Settings */}
        <TabsContent value="general" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Parking Lot Information</CardTitle>
              <CardDescription>
                Basic details about your parking facility
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Parking Lot Name</Label>
                  <Input
                    id="name"
                    value={settings.parkingLot?.name || ''}
                    onChange={(e) => updateSettings('parkingLot', 'name', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="org-name">Organization Name</Label>
                  <Input
                    id="org-name"
                    value={settings.organization.name}
                    onChange={(e) => updateSettings('organization', 'name', e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  value={settings.parkingLot?.address || ''}
                  onChange={(e) => updateSettings('parkingLot', 'address', e.target.value)}
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="country">Country</Label>
                  <Select
                    value={settings.parkingLot?.country || 'India'}
                    onValueChange={(value) => updateSettings('parkingLot', 'country', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      {countryOptions.map((country) => (
                        <SelectItem key={country.value} value={country.label}>
                          {country.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="currency">Currency</Label>
                  <Select
                    value={settings.parkingLot?.currency || 'INR'}
                    onValueChange={(value) => updateSettings('parkingLot', 'currency', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      {currencyOptions.map((currency) => (
                        <SelectItem key={currency.value} value={currency.value}>
                          {currency.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="timezone">Timezone</Label>
                  <Select
                    value={settings.parkingLot?.timezone || 'Asia/Kolkata'}
                    onValueChange={(value) => updateSettings('parkingLot', 'timezone', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      {Object.entries(countries).map(([code, country]) => (
                        <SelectItem key={code} value={country.timezone}>
                          {country.timezone}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="venue-type">Venue Type</Label>
                  <Select
                    value={settings.parkingLot?.venueType || 'MALL'}
                    onValueChange={(value) => updateSettings('parkingLot', 'venueType', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AIRPORT">Airport</SelectItem>
                      <SelectItem value="MALL">Shopping Mall</SelectItem>
                      <SelectItem value="CINEMA">Cinema Hall</SelectItem>
                      <SelectItem value="COMMERCIAL">Commercial Complex</SelectItem>
                      <SelectItem value="HOSPITAL">Hospital</SelectItem>
                      <SelectItem value="STADIUM">Stadium</SelectItem>
                      <SelectItem value="HOTEL">Hotel</SelectItem>
                      <SelectItem value="RESIDENTIAL">Residential</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Operating Hours</CardTitle>
              <CardDescription>
                Set your parking facility&apos;s operating schedule
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>24/7 Operation</Label>
                  <p className="text-sm text-muted-foreground">
                    Parking lot operates round the clock
                  </p>
                </div>
                <Switch
                  checked={is24_7}
                  onCheckedChange={setIs24_7}
                />
              </div>
              <Separator />
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Opening Time</Label>
                  <Input type="time" defaultValue="06:00" disabled={is24_7} />
                </div>
                <div className="space-y-2">
                  <Label>Closing Time</Label>
                  <Input type="time" defaultValue="23:00" disabled={is24_7} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Features</CardTitle>
              <CardDescription>
                Enable or disable parking lot features
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>ANPR (Automatic Number Plate Recognition)</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically read license plates at entry/exit
                  </p>
                </div>
                <Switch
                  checked={settings.features.anprEnabled}
                  onCheckedChange={(checked) => updateSettings('features', 'anprEnabled', checked)}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>EV Charging Integration</Label>
                  <p className="text-sm text-muted-foreground">
                    Support for electric vehicle charging stations
                  </p>
                </div>
                <Switch
                  checked={settings.features.evChargingEnabled}
                  onCheckedChange={(checked) => updateSettings('features', 'evChargingEnabled', checked)}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Valet Service</Label>
                  <p className="text-sm text-muted-foreground">
                    Enable valet parking workflow
                  </p>
                </div>
                <Switch
                  checked={settings.features.valetEnabled}
                  onCheckedChange={(checked) => updateSettings('features', 'valetEnabled', checked)}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Reservation System</Label>
                  <p className="text-sm text-muted-foreground">
                    Allow advance slot reservations
                  </p>
                </div>
                <Switch
                  checked={settings.features.reservationEnabled}
                  onCheckedChange={(checked) => updateSettings('features', 'reservationEnabled', checked)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Pricing Settings */}
        <TabsContent value="pricing" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Default Pricing Rules</CardTitle>
              <CardDescription>
                Configure base pricing for your parking lot
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Pricing Model</Label>
                  <Select
                    value={settings.pricing.pricingModel}
                    onValueChange={(value) => updateSettings('pricing', 'pricingModel', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="flat">Flat Rate</SelectItem>
                      <SelectItem value="hourly">Hourly</SelectItem>
                      <SelectItem value="slab">Time Slabs</SelectItem>
                      <SelectItem value="dynamic">Dynamic</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Base Rate (First Hour)</Label>
                  <Input
                    type="number"
                    value={settings.pricing.baseRate}
                    onChange={(e) => updateSettings('pricing', 'baseRate', Number(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Hourly Rate (After First Hour)</Label>
                  <Input
                    type="number"
                    value={settings.pricing.hourlyRate}
                    onChange={(e) => updateSettings('pricing', 'hourlyRate', Number(e.target.value))}
                  />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Daily Maximum</Label>
                  <Input
                    type="number"
                    value={settings.pricing.dailyMaximum}
                    onChange={(e) => updateSettings('pricing', 'dailyMaximum', Number(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Lost Ticket Fee</Label>
                  <Input
                    type="number"
                    value={settings.pricing.lostTicketFee}
                    onChange={(e) => updateSettings('pricing', 'lostTicketFee', Number(e.target.value))}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tax Configuration</CardTitle>
              <CardDescription>
                Configure applicable taxes
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Apply GST</Label>
                  <p className="text-sm text-muted-foreground">
                    Include GST on all transactions
                  </p>
                </div>
                <Switch
                  checked={settings.pricing.applyGst}
                  onCheckedChange={(checked) => updateSettings('pricing', 'applyGst', checked)}
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>GST Number</Label>
                  <Input
                    value={settings.pricing.gstNumber}
                    onChange={(e) => updateSettings('pricing', 'gstNumber', e.target.value)}
                    placeholder="29AABCU9603R1ZM"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tax Rate (%)</Label>
                  <Input
                    type="number"
                    value={settings.pricing.taxRate}
                    onChange={(e) => updateSettings('pricing', 'taxRate', Number(e.target.value))}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notification Settings */}
        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Alert Rules</CardTitle>
              <CardDescription>
                Configure automatic alerts and notifications
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>High Occupancy Alert</Label>
                  <p className="text-sm text-muted-foreground">
                    Notify when occupancy exceeds 85%
                  </p>
                </div>
                <Switch
                  checked={settings.alerts.highOccupancyAlert}
                  onCheckedChange={(checked) => updateSettings('alerts', 'highOccupancyAlert', checked)}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Camera Offline Alert</Label>
                  <p className="text-sm text-muted-foreground">
                    Notify when cameras go offline
                  </p>
                </div>
                <Switch
                  checked={settings.alerts.cameraOfflineAlert}
                  onCheckedChange={(checked) => updateSettings('alerts', 'cameraOfflineAlert', checked)}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Payment Failure Alert</Label>
                  <p className="text-sm text-muted-foreground">
                    Notify on payment transaction failures
                  </p>
                </div>
                <Switch
                  checked={settings.alerts.paymentFailureAlert}
                  onCheckedChange={(checked) => updateSettings('alerts', 'paymentFailureAlert', checked)}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Daily Report</Label>
                  <p className="text-sm text-muted-foreground">
                    Send daily summary report via email
                  </p>
                </div>
                <Switch
                  checked={settings.alerts.dailyReport}
                  onCheckedChange={(checked) => updateSettings('alerts', 'dailyReport', checked)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Notification Channels</CardTitle>
              <CardDescription>
                Configure how you receive alerts
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Email Recipients</Label>
                <Input
                  value={settings.alerts.emailRecipients}
                  onChange={(e) => updateSettings('alerts', 'emailRecipients', e.target.value)}
                  placeholder="admin@sparking.io, ops@sparking.io"
                />
              </div>
              <div className="space-y-2">
                <Label>SMS Numbers</Label>
                <Input
                  value={settings.alerts.smsNumbers}
                  onChange={(e) => updateSettings('alerts', 'smsNumbers', e.target.value)}
                  placeholder="+91 98765 43210"
                />
              </div>
              <div className="space-y-2">
                <Label>Webhook URL (optional)</Label>
                <Input
                  value={settings.alerts.webhookUrl}
                  onChange={(e) => updateSettings('alerts', 'webhookUrl', e.target.value)}
                  placeholder="https://your-webhook-url.com/alerts"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Settings */}
        <TabsContent value="security" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Authentication</CardTitle>
              <CardDescription>
                Security and access control settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Two-Factor Authentication</Label>
                  <p className="text-sm text-muted-foreground">
                    Require 2FA for all admin accounts
                  </p>
                </div>
                <Switch
                  checked={settings.security.twoFactorEnabled}
                  onCheckedChange={(checked) => updateSettings('security', 'twoFactorEnabled', checked)}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Session Timeout</Label>
                  <p className="text-sm text-muted-foreground">
                    Auto logout after inactivity
                  </p>
                </div>
                <Select
                  value={settings.security.sessionTimeout}
                  onValueChange={(value) => updateSettings('security', 'sessionTimeout', value)}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1h">1 hour</SelectItem>
                    <SelectItem value="4h">4 hours</SelectItem>
                    <SelectItem value="8h">8 hours</SelectItem>
                    <SelectItem value="24h">24 hours</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Audit Logging</Label>
                  <p className="text-sm text-muted-foreground">
                    Log all user actions for compliance
                  </p>
                </div>
                <Switch
                  checked={settings.security.auditLogging}
                  onCheckedChange={(checked) => updateSettings('security', 'auditLogging', checked)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Data Privacy</CardTitle>
              <CardDescription>
                GDPR and data retention settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>License Plate Hashing</Label>
                  <p className="text-sm text-muted-foreground">
                    Store hashed license plates for privacy
                  </p>
                </div>
                <Switch
                  checked={settings.security.licensePlateHashing}
                  onCheckedChange={(checked) => updateSettings('security', 'licensePlateHashing', checked)}
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Transaction Data Retention</Label>
                  <Select
                    value={settings.security.transactionRetention}
                    onValueChange={(value) => updateSettings('security', 'transactionRetention', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="6m">6 months</SelectItem>
                      <SelectItem value="1y">1 year</SelectItem>
                      <SelectItem value="2y">2 years</SelectItem>
                      <SelectItem value="5y">5 years</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Video Footage Retention</Label>
                  <Select
                    value={settings.security.videoRetention}
                    onValueChange={(value) => updateSettings('security', 'videoRetention', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7d">7 days</SelectItem>
                      <SelectItem value="15d">15 days</SelectItem>
                      <SelectItem value="30d">30 days</SelectItem>
                      <SelectItem value="90d">90 days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Appearance Settings */}
        <TabsContent value="appearance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Digital Signage</CardTitle>
              <CardDescription>
                Configure LED displays and kiosks
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Available Slots Color</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={settings.display.availableSlotsColor}
                      onChange={(e) => updateSettings('display', 'availableSlotsColor', e.target.value)}
                      className="w-14 h-10"
                    />
                    <Input
                      value={settings.display.availableSlotsColor}
                      onChange={(e) => updateSettings('display', 'availableSlotsColor', e.target.value)}
                      className="flex-1"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Full Zone Color</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={settings.display.fullZoneColor}
                      onChange={(e) => updateSettings('display', 'fullZoneColor', e.target.value)}
                      className="w-14 h-10"
                    />
                    <Input
                      value={settings.display.fullZoneColor}
                      onChange={(e) => updateSettings('display', 'fullZoneColor', e.target.value)}
                      className="flex-1"
                    />
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Show Zone Names</Label>
                  <p className="text-sm text-muted-foreground">
                    Display zone names on signage
                  </p>
                </div>
                <Switch
                  checked={settings.display.showZoneNames}
                  onCheckedChange={(checked) => updateSettings('display', 'showZoneNames', checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Show Directional Arrows</Label>
                  <p className="text-sm text-muted-foreground">
                    Display navigation arrows
                  </p>
                </div>
                <Switch
                  checked={settings.display.showDirectionalArrows}
                  onCheckedChange={(checked) => updateSettings('display', 'showDirectionalArrows', checked)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Dashboard Preferences</CardTitle>
              <CardDescription>
                Customize the admin dashboard
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Auto-refresh Dashboard</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically update stats every 30 seconds
                  </p>
                </div>
                <Switch
                  checked={settings.display.autoRefresh}
                  onCheckedChange={(checked) => updateSettings('display', 'autoRefresh', checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Compact View</Label>
                  <p className="text-sm text-muted-foreground">
                    Show more data in less space
                  </p>
                </div>
                <Switch
                  checked={settings.display.compactView}
                  onCheckedChange={(checked) => updateSettings('display', 'compactView', checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Sound Alerts</Label>
                  <p className="text-sm text-muted-foreground">
                    Play sound on new alerts
                  </p>
                </div>
                <Switch
                  checked={settings.display.soundAlerts}
                  onCheckedChange={(checked) => updateSettings('display', 'soundAlerts', checked)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
