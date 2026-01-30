/**
 * Settings API
 * Manage organization and parking lot settings
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { getCurrentUser } from '@/lib/auth/session'
import { successResponse, handleApiError } from '@/lib/utils/api'
import { z } from 'zod'
import { logger } from '@/lib/logger'

// Schema for updating settings
const settingsUpdateSchema = z.object({
  // Organization settings
  organization: z.object({
    name: z.string().min(1).max(100).optional(),
    primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
    secondaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
    defaultCurrency: z.string().length(3).optional(),
    defaultTimezone: z.string().optional(),
    anprEnabled: z.boolean().optional(),
    evChargingEnabled: z.boolean().optional(),
  }).optional(),
  // Parking lot settings
  parkingLot: z.object({
    name: z.string().min(1).max(100).optional(),
    address: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    country: z.string().optional(),
    currency: z.string().length(3).optional(),
    timezone: z.string().optional(),
    venueType: z.enum(['AIRPORT', 'MALL', 'CINEMA', 'COMMERCIAL', 'HOSPITAL', 'STADIUM', 'HOTEL', 'RESIDENTIAL', 'OTHER']).optional(),
    operatingHours: z.record(z.object({
      open: z.string(),
      close: z.string(),
    })).optional(),
    hasEvCharging: z.boolean().optional(),
    hasValetService: z.boolean().optional(),
  }).optional(),
  // Feature flags
  features: z.object({
    anprEnabled: z.boolean().optional(),
    evChargingEnabled: z.boolean().optional(),
    valetEnabled: z.boolean().optional(),
    reservationEnabled: z.boolean().optional(),
  }).optional(),
  // Alert settings
  alerts: z.object({
    highOccupancyAlert: z.boolean().optional(),
    cameraOfflineAlert: z.boolean().optional(),
    paymentFailureAlert: z.boolean().optional(),
    dailyReport: z.boolean().optional(),
    emailRecipients: z.string().optional(),
    smsNumbers: z.string().optional(),
    webhookUrl: z.string().url().optional().or(z.literal('')),
  }).optional(),
  // Security settings
  security: z.object({
    twoFactorEnabled: z.boolean().optional(),
    sessionTimeout: z.enum(['1h', '4h', '8h', '24h']).optional(),
    auditLogging: z.boolean().optional(),
    licensePlateHashing: z.boolean().optional(),
    transactionRetention: z.enum(['6m', '1y', '2y', '5y']).optional(),
    videoRetention: z.enum(['7d', '15d', '30d', '90d']).optional(),
  }).optional(),
  // Display settings
  display: z.object({
    availableSlotsColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
    fullZoneColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
    showZoneNames: z.boolean().optional(),
    showDirectionalArrows: z.boolean().optional(),
    autoRefresh: z.boolean().optional(),
    compactView: z.boolean().optional(),
    soundAlerts: z.boolean().optional(),
  }).optional(),
  // Pricing settings
  pricing: z.object({
    pricingModel: z.enum(['flat', 'hourly', 'slab', 'dynamic']).optional(),
    baseRate: z.number().min(0).optional(),
    hourlyRate: z.number().min(0).optional(),
    dailyMaximum: z.number().min(0).optional(),
    lostTicketFee: z.number().min(0).optional(),
    applyGst: z.boolean().optional(),
    gstNumber: z.string().optional(),
    taxRate: z.number().min(0).max(100).optional(),
  }).optional(),
})

// GET /api/settings - Fetch current settings
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only ADMIN or SUPER_ADMIN can view settings
    if (!['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get organization with settings
    const organization = await prisma.organization.findFirst({
      include: {
        settings: true,
        parkingLots: {
          take: 1,
          orderBy: { createdAt: 'asc' },
          include: {
            pricingRules: {
              where: { isActive: true },
              take: 1,
              orderBy: { priority: 'desc' },
            },
          },
        },
      },
    })

    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    const parkingLot = organization.parkingLots[0]
    const pricingRule = parkingLot?.pricingRules[0]

    // Get system config for additional settings
    const systemConfigs = await prisma.systemConfig.findMany({
      where: {
        key: {
          in: [
            'alerts.highOccupancy',
            'alerts.cameraOffline',
            'alerts.paymentFailure',
            'alerts.dailyReport',
            'alerts.emailRecipients',
            'alerts.smsNumbers',
            'alerts.webhookUrl',
            'security.twoFactorEnabled',
            'security.sessionTimeout',
            'security.auditLogging',
            'security.licensePlateHashing',
            'security.transactionRetention',
            'security.videoRetention',
            'display.availableSlotsColor',
            'display.fullZoneColor',
            'display.showZoneNames',
            'display.showDirectionalArrows',
            'display.autoRefresh',
            'display.compactView',
            'display.soundAlerts',
          ],
        },
      },
    })

    // Convert system configs to a map
    const configMap: Record<string, unknown> = {}
    for (const config of systemConfigs) {
      configMap[config.key] = config.value
    }

    const settings = {
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        logo: organization.logo,
        primaryColor: organization.settings?.primaryColor || '#1E3A5F',
        secondaryColor: organization.settings?.secondaryColor || '#3182CE',
        defaultCurrency: organization.settings?.defaultCurrency || 'INR',
        defaultTimezone: organization.settings?.defaultTimezone || 'Asia/Kolkata',
        anprEnabled: organization.settings?.anprEnabled || false,
        evChargingEnabled: organization.settings?.evChargingEnabled || false,
      },
      parkingLot: parkingLot ? {
        id: parkingLot.id,
        name: parkingLot.name,
        slug: parkingLot.slug,
        address: parkingLot.address,
        city: parkingLot.city,
        state: parkingLot.state,
        country: parkingLot.country,
        currency: parkingLot.currency,
        timezone: parkingLot.timezone,
        venueType: parkingLot.venueType,
        operatingHours: parkingLot.operatingHours,
        hasEvCharging: parkingLot.hasEvCharging,
        hasValetService: parkingLot.hasValetService,
        totalSlots: parkingLot.totalSlots,
      } : null,
      features: {
        anprEnabled: organization.settings?.anprEnabled || false,
        evChargingEnabled: parkingLot?.hasEvCharging || false,
        valetEnabled: parkingLot?.hasValetService || false,
        reservationEnabled: true, // Default enabled
      },
      alerts: {
        highOccupancyAlert: configMap['alerts.highOccupancy'] ?? true,
        cameraOfflineAlert: configMap['alerts.cameraOffline'] ?? true,
        paymentFailureAlert: configMap['alerts.paymentFailure'] ?? true,
        dailyReport: configMap['alerts.dailyReport'] ?? true,
        emailRecipients: configMap['alerts.emailRecipients'] ?? '',
        smsNumbers: configMap['alerts.smsNumbers'] ?? '',
        webhookUrl: configMap['alerts.webhookUrl'] ?? '',
      },
      security: {
        twoFactorEnabled: configMap['security.twoFactorEnabled'] ?? false,
        sessionTimeout: configMap['security.sessionTimeout'] ?? '8h',
        auditLogging: configMap['security.auditLogging'] ?? true,
        licensePlateHashing: configMap['security.licensePlateHashing'] ?? false,
        transactionRetention: configMap['security.transactionRetention'] ?? '2y',
        videoRetention: configMap['security.videoRetention'] ?? '30d',
      },
      display: {
        availableSlotsColor: configMap['display.availableSlotsColor'] ?? '#22c55e',
        fullZoneColor: configMap['display.fullZoneColor'] ?? '#ef4444',
        showZoneNames: configMap['display.showZoneNames'] ?? true,
        showDirectionalArrows: configMap['display.showDirectionalArrows'] ?? true,
        autoRefresh: configMap['display.autoRefresh'] ?? true,
        compactView: configMap['display.compactView'] ?? false,
        soundAlerts: configMap['display.soundAlerts'] ?? false,
      },
      pricing: pricingRule ? {
        pricingModel: pricingRule.pricingModel.toLowerCase(),
        baseRate: pricingRule.baseRate / 100, // Convert from paisa
        hourlyRate: (pricingRule.hourlyRate || 0) / 100,
        dailyMaximum: (pricingRule.dailyMaxRate || 0) / 100,
        lostTicketFee: 500, // Default
        applyGst: true,
        gstNumber: '',
        taxRate: 18,
      } : {
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

    logger.info('Settings fetched', { userId: user.id })

    return successResponse(settings)
  } catch (error) {
    return handleApiError(error)
  }
}

// PATCH /api/settings - Update settings
export async function PATCH(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only ADMIN or SUPER_ADMIN can update settings
    if (!['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const data = settingsUpdateSchema.parse(body)

    // Get organization
    const organization = await prisma.organization.findFirst({
      include: {
        settings: true,
        parkingLots: {
          take: 1,
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Update organization settings
    if (data.organization) {
      const { name, ...settingsData } = data.organization

      // Update organization name if provided
      if (name) {
        await prisma.organization.update({
          where: { id: organization.id },
          data: { name },
        })
      }

      // Upsert organization settings
      if (Object.keys(settingsData).length > 0) {
        await prisma.organizationSettings.upsert({
          where: { organizationId: organization.id },
          create: {
            organizationId: organization.id,
            ...settingsData,
          },
          update: settingsData,
        })
      }
    }

    // Update parking lot settings
    if (data.parkingLot && organization.parkingLots[0]) {
      const parkingLotId = organization.parkingLots[0].id
      await prisma.parkingLot.update({
        where: { id: parkingLotId },
        data: {
          ...data.parkingLot,
          operatingHours: data.parkingLot.operatingHours as object | undefined,
        },
      })
    }

    // Update system configs for alerts, security, and display
    const configUpdates: { key: string; value: unknown }[] = []

    if (data.alerts) {
      if (data.alerts.highOccupancyAlert !== undefined) {
        configUpdates.push({ key: 'alerts.highOccupancy', value: data.alerts.highOccupancyAlert })
      }
      if (data.alerts.cameraOfflineAlert !== undefined) {
        configUpdates.push({ key: 'alerts.cameraOffline', value: data.alerts.cameraOfflineAlert })
      }
      if (data.alerts.paymentFailureAlert !== undefined) {
        configUpdates.push({ key: 'alerts.paymentFailure', value: data.alerts.paymentFailureAlert })
      }
      if (data.alerts.dailyReport !== undefined) {
        configUpdates.push({ key: 'alerts.dailyReport', value: data.alerts.dailyReport })
      }
      if (data.alerts.emailRecipients !== undefined) {
        configUpdates.push({ key: 'alerts.emailRecipients', value: data.alerts.emailRecipients })
      }
      if (data.alerts.smsNumbers !== undefined) {
        configUpdates.push({ key: 'alerts.smsNumbers', value: data.alerts.smsNumbers })
      }
      if (data.alerts.webhookUrl !== undefined) {
        configUpdates.push({ key: 'alerts.webhookUrl', value: data.alerts.webhookUrl })
      }
    }

    if (data.security) {
      if (data.security.twoFactorEnabled !== undefined) {
        configUpdates.push({ key: 'security.twoFactorEnabled', value: data.security.twoFactorEnabled })
      }
      if (data.security.sessionTimeout !== undefined) {
        configUpdates.push({ key: 'security.sessionTimeout', value: data.security.sessionTimeout })
      }
      if (data.security.auditLogging !== undefined) {
        configUpdates.push({ key: 'security.auditLogging', value: data.security.auditLogging })
      }
      if (data.security.licensePlateHashing !== undefined) {
        configUpdates.push({ key: 'security.licensePlateHashing', value: data.security.licensePlateHashing })
      }
      if (data.security.transactionRetention !== undefined) {
        configUpdates.push({ key: 'security.transactionRetention', value: data.security.transactionRetention })
      }
      if (data.security.videoRetention !== undefined) {
        configUpdates.push({ key: 'security.videoRetention', value: data.security.videoRetention })
      }
    }

    if (data.display) {
      if (data.display.availableSlotsColor !== undefined) {
        configUpdates.push({ key: 'display.availableSlotsColor', value: data.display.availableSlotsColor })
      }
      if (data.display.fullZoneColor !== undefined) {
        configUpdates.push({ key: 'display.fullZoneColor', value: data.display.fullZoneColor })
      }
      if (data.display.showZoneNames !== undefined) {
        configUpdates.push({ key: 'display.showZoneNames', value: data.display.showZoneNames })
      }
      if (data.display.showDirectionalArrows !== undefined) {
        configUpdates.push({ key: 'display.showDirectionalArrows', value: data.display.showDirectionalArrows })
      }
      if (data.display.autoRefresh !== undefined) {
        configUpdates.push({ key: 'display.autoRefresh', value: data.display.autoRefresh })
      }
      if (data.display.compactView !== undefined) {
        configUpdates.push({ key: 'display.compactView', value: data.display.compactView })
      }
      if (data.display.soundAlerts !== undefined) {
        configUpdates.push({ key: 'display.soundAlerts', value: data.display.soundAlerts })
      }
    }

    // Upsert all config updates
    for (const config of configUpdates) {
      await prisma.systemConfig.upsert({
        where: { key: config.key },
        create: {
          key: config.key,
          value: config.value as object,
        },
        update: {
          value: config.value as object,
        },
      })
    }

    logger.info('Settings updated', { userId: user.id, updatedKeys: Object.keys(data) })

    return successResponse({ success: true }, 'Settings saved successfully')
  } catch (error) {
    return handleApiError(error)
  }
}
