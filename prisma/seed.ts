/**
 * Production Demo Database Seed
 * Creates comprehensive demo data for a production-level demonstration
 */

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import bcrypt from 'bcryptjs'
import 'dotenv/config'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

// Demo vehicles data
const DEMO_VEHICLES = [
  { plate: 'KA01AB1234', type: 'CAR', color: 'White', make: 'Toyota', model: 'Camry' },
  { plate: 'KA02CD5678', type: 'SUV', color: 'Black', make: 'Honda', model: 'CR-V' },
  { plate: 'KA03EF9012', type: 'CAR', color: 'Silver', make: 'Hyundai', model: 'i20' },
  { plate: 'KA04GH3456', type: 'CAR', color: 'Red', make: 'Maruti', model: 'Swift' },
  { plate: 'KA05IJ7890', type: 'SUV', color: 'Blue', make: 'Tata', model: 'Harrier' },
  { plate: 'MH01KL2345', type: 'CAR', color: 'Grey', make: 'Volkswagen', model: 'Polo' },
  { plate: 'MH02MN6789', type: 'CAR', color: 'White', make: 'Kia', model: 'Seltos' },
  { plate: 'TN01OP1234', type: 'MOTORCYCLE', color: 'Black', make: 'Royal Enfield', model: 'Classic 350' },
  { plate: 'DL01QR5678', type: 'CAR', color: 'Brown', make: 'Mahindra', model: 'XUV700' },
  { plate: 'GJ01ST9012', type: 'CAR', color: 'Green', make: 'MG', model: 'Hector' },
]

async function main() {
  console.log('🌱 Starting production demo database seed...')
  console.log('')

  // ================================================
  // ORGANIZATION & SETTINGS
  // ================================================
  const org = await prisma.organization.upsert({
    where: { slug: 'phoenix-parking' },
    update: {},
    create: {
      name: 'Phoenix Parking Solutions',
      slug: 'phoenix-parking',
      logo: '/images/phoenix-logo.png',
    },
  })

  await prisma.organizationSettings.upsert({
    where: { organizationId: org.id },
    update: {},
    create: {
      organizationId: org.id,
      primaryColor: '#1E3A5F',
      secondaryColor: '#3182CE',
      defaultCurrency: 'INR',
      defaultTimezone: 'Asia/Kolkata',
      anprEnabled: true,
      evChargingEnabled: true,
    },
  })
  console.log('✅ Organization created:', org.name)

  // ================================================
  // USERS
  // ================================================
  const passwordHash = await bcrypt.hash('demo123', 10)

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@demo.sparking.io' },
    update: {},
    create: {
      email: 'admin@demo.sparking.io',
      passwordHash,
      name: 'Rajesh Kumar',
      phone: '+919876543210',
      role: 'ADMIN',
      status: 'ACTIVE',
      organizationId: org.id,
    },
  })

  const operatorUser = await prisma.user.upsert({
    where: { email: 'operator@demo.sparking.io' },
    update: {},
    create: {
      email: 'operator@demo.sparking.io',
      passwordHash,
      name: 'Priya Sharma',
      phone: '+919876543211',
      role: 'OPERATOR',
      status: 'ACTIVE',
      organizationId: org.id,
    },
  })

  const viewerUser = await prisma.user.upsert({
    where: { email: 'viewer@demo.sparking.io' },
    update: {},
    create: {
      email: 'viewer@demo.sparking.io',
      passwordHash,
      name: 'Amit Patel',
      phone: '+919876543212',
      role: 'VIEWER',
      status: 'ACTIVE',
      organizationId: org.id,
    },
  })
  console.log('✅ Users created: admin, operator, viewer')

  // ================================================
  // PARKING LOT - MALL
  // ================================================
  const mallLot = await prisma.parkingLot.upsert({
    where: {
      organizationId_slug: {
        organizationId: org.id,
        slug: 'phoenix-marketcity',
      },
    },
    update: {},
    create: {
      organizationId: org.id,
      name: 'Phoenix MarketCity',
      slug: 'phoenix-marketcity',
      venueType: 'MALL',
      address: 'Whitefield Main Road',
      city: 'Bangalore',
      state: 'Karnataka',
      country: 'India',
      postalCode: '560066',
      latitude: 12.9969,
      longitude: 77.7499,
      timezone: 'Asia/Kolkata',
      currency: 'INR',
      status: 'ACTIVE',
      totalSlots: 0,
      hasEvCharging: true,
      hasValetService: true,
      hasMultiLevel: true,
      operatingHours: {
        monday: { open: '06:00', close: '23:00' },
        tuesday: { open: '06:00', close: '23:00' },
        wednesday: { open: '06:00', close: '23:00' },
        thursday: { open: '06:00', close: '23:00' },
        friday: { open: '06:00', close: '23:59' },
        saturday: { open: '06:00', close: '23:59' },
        sunday: { open: '08:00', close: '22:00' },
      },
    },
  })
  console.log('✅ Parking lot created:', mallLot.name)

  // ================================================
  // ZONES
  // ================================================
  const zoneConfigs = [
    { name: 'Basement 2', code: 'B2', level: -2, zoneType: 'GENERAL' as const, color: '#6B7280', slots: 100 },
    { name: 'Basement 1', code: 'B1', level: -1, zoneType: 'GENERAL' as const, color: '#9CA3AF', slots: 100 },
    { name: 'Ground Floor', code: 'GF', level: 0, zoneType: 'SHORT_TERM' as const, color: '#3B82F6', slots: 50 },
    { name: 'VIP Parking', code: 'VIP', level: 0, zoneType: 'VIP' as const, color: '#F59E0B', slots: 20 },
    { name: 'EV Charging', code: 'EV', level: -1, zoneType: 'EV_CHARGING' as const, color: '#10B981', slots: 15 },
    { name: 'Two Wheeler', code: '2W', level: -2, zoneType: 'TWO_WHEELER' as const, color: '#8B5CF6', slots: 75 },
    { name: 'Staff Parking', code: 'STAFF', level: -2, zoneType: 'STAFF' as const, color: '#EC4899', slots: 30 },
  ]

  const createdZones: { zone: any; config: typeof zoneConfigs[0] }[] = []

  for (const config of zoneConfigs) {
    const zone = await prisma.zone.upsert({
      where: {
        parkingLotId_code: {
          parkingLotId: mallLot.id,
          code: config.code,
        },
      },
      update: {},
      create: {
        parkingLotId: mallLot.id,
        name: config.name,
        code: config.code,
        level: config.level,
        zoneType: config.zoneType,
        color: config.color,
        status: 'ACTIVE',
      },
    })

    // Create slots
    const existingSlots = await prisma.slot.count({ where: { zoneId: zone.id } })
    if (existingSlots === 0) {
      const slots = []
      for (let i = 1; i <= config.slots; i++) {
        const isOccupied = Math.random() > 0.55 // 45% occupied
        slots.push({
          zoneId: zone.id,
          slotNumber: `${config.code}-${String(i).padStart(3, '0')}`,
          slotType: config.zoneType === 'EV_CHARGING' ? 'EV_CHARGING' as const : config.zoneType === 'VIP' ? 'VIP' as const : 'STANDARD' as const,
          vehicleType: config.zoneType === 'TWO_WHEELER' ? 'MOTORCYCLE' as const : 'CAR' as const,
          status: 'AVAILABLE' as const,
          isOccupied,
          confidence: isOccupied ? 0.85 + Math.random() * 0.15 : 0,
          lastDetectedAt: isOccupied ? new Date() : null,
          hasEvCharger: config.zoneType === 'EV_CHARGING',
          hasRoof: config.level < 0,
          positionX: (i % 10) * 55,
          positionY: Math.floor(i / 10) * 110,
        })
      }
      await prisma.slot.createMany({ data: slots })
    }

    createdZones.push({ zone, config })
  }
  console.log('✅ Zones and slots created:', zoneConfigs.length, 'zones')

  // Update total slots
  const totalSlots = await prisma.slot.count({
    where: { zone: { parkingLotId: mallLot.id } },
  })
  await prisma.parkingLot.update({
    where: { id: mallLot.id },
    data: { totalSlots },
  })

  // ================================================
  // CAMERAS
  // ================================================
  const cameraConfigs = [
    { zone: 'B2', name: 'Basement 2 Entry', coverage: 25 },
    { zone: 'B2', name: 'Basement 2 Center', coverage: 30 },
    { zone: 'B1', name: 'Basement 1 Entry', coverage: 25 },
    { zone: 'B1', name: 'Basement 1 Center', coverage: 30 },
    { zone: 'GF', name: 'Ground Floor Main', coverage: 20 },
    { zone: 'VIP', name: 'VIP Section', coverage: 20 },
    { zone: 'EV', name: 'EV Charging Area', coverage: 15 },
    { zone: '2W', name: 'Two Wheeler Section', coverage: 40 },
  ]

  for (let i = 0; i < cameraConfigs.length; i++) {
    const config = cameraConfigs[i]
    const zoneData = createdZones.find(z => z.config.code === config.zone)

    if (zoneData) {
      await prisma.camera.upsert({
        where: { id: `cam-mall-${i + 1}` },
        update: {},
        create: {
          id: `cam-mall-${i + 1}`,
          parkingLotId: mallLot.id,
          zoneId: zoneData.zone.id,
          name: config.name,
          rtspUrl: `rtsp://demo.sparking.io:8554/cam${i + 1}`,
          onvifUrl: `http://demo.sparking.io:8080/onvif/cam${i + 1}`,
          status: Math.random() > 0.1 ? 'ONLINE' : 'OFFLINE',
          coverageSlots: config.coverage,
          resolution: '1920x1080',
          fps: 25,
          hasIR: true,
          hasPTZ: i < 2,
          lastPingAt: new Date(Date.now() - Math.random() * 60000),
        },
      })
    }
  }
  console.log('✅ Cameras created:', cameraConfigs.length)

  // ================================================
  // GATES
  // ================================================
  await prisma.gate.upsert({
    where: { id: 'gate-mall-entry-1' },
    update: {},
    create: {
      id: 'gate-mall-entry-1',
      parkingLotId: mallLot.id,
      name: 'Main Entry - Gate 1',
      gateType: 'ENTRY',
      controllerType: 'RS485',
      controllerAddress: '192.168.1.100:502',
      status: 'CLOSED',
    },
  })

  await prisma.gate.upsert({
    where: { id: 'gate-mall-entry-2' },
    update: {},
    create: {
      id: 'gate-mall-entry-2',
      parkingLotId: mallLot.id,
      name: 'Secondary Entry - Gate 2',
      gateType: 'ENTRY',
      controllerType: 'RS485',
      controllerAddress: '192.168.1.101:502',
      status: 'CLOSED',
    },
  })

  await prisma.gate.upsert({
    where: { id: 'gate-mall-exit-1' },
    update: {},
    create: {
      id: 'gate-mall-exit-1',
      parkingLotId: mallLot.id,
      name: 'Main Exit - Gate 1',
      gateType: 'EXIT',
      controllerType: 'RS485',
      controllerAddress: '192.168.1.102:502',
      status: 'CLOSED',
    },
  })

  await prisma.gate.upsert({
    where: { id: 'gate-mall-exit-2' },
    update: {},
    create: {
      id: 'gate-mall-exit-2',
      parkingLotId: mallLot.id,
      name: 'Secondary Exit - Gate 2',
      gateType: 'EXIT',
      controllerType: 'RS485',
      controllerAddress: '192.168.1.103:502',
      status: 'CLOSED',
    },
  })
  console.log('✅ Gates created: 4')

  // ================================================
  // DISPLAYS
  // ================================================
  await prisma.display.upsert({
    where: { id: 'display-mall-entry' },
    update: {},
    create: {
      id: 'display-mall-entry',
      parkingLotId: mallLot.id,
      name: 'Entry Counter Display',
      displayType: 'LED_COUNTER',
      protocol: 'Serial',
      address: '/dev/ttyUSB0',
      currentMessage: `AVAILABLE: ${totalSlots - Math.floor(totalSlots * 0.45)}`,
      status: 'ONLINE',
    },
  })

  await prisma.display.upsert({
    where: { id: 'display-mall-directional' },
    update: {},
    create: {
      id: 'display-mall-directional',
      parkingLotId: mallLot.id,
      name: 'Directional Display',
      displayType: 'DIRECTIONAL',
      protocol: 'HTTP',
      address: 'http://192.168.1.150:8080',
      currentMessage: 'B1: 55 | B2: 45 | GF: 28',
      status: 'ONLINE',
    },
  })
  console.log('✅ Displays created: 2')

  // ================================================
  // PRICING RULES
  // ================================================
  await prisma.pricingRule.deleteMany({ where: { parkingLotId: mallLot.id } })

  await prisma.pricingRule.create({
    data: {
      parkingLotId: mallLot.id,
      name: 'Standard Hourly (Car)',
      zoneTypes: ['GENERAL', 'SHORT_TERM'],
      vehicleTypes: ['CAR', 'SUV'],
      pricingModel: 'SLAB',
      baseRate: 4000, // ₹40 first 2 hours
      hourlyRate: 2000, // ₹20 per additional hour
      dailyMaxRate: 20000, // ₹200 max per day
      slabs: [
        { upToHours: 2, rate: 4000 },
        { upToHours: 4, rate: 6000 },
        { upToHours: 8, rate: 10000 },
        { upToHours: 24, rate: 20000 },
      ],
      peakHourMultiplier: 1.5,
      peakHours: { start: '17:00', end: '21:00' },
      isActive: true,
      priority: 1,
    },
  })

  await prisma.pricingRule.create({
    data: {
      parkingLotId: mallLot.id,
      name: 'VIP Parking',
      zoneTypes: ['VIP'],
      vehicleTypes: ['CAR', 'SUV'],
      pricingModel: 'HOURLY',
      baseRate: 10000, // ₹100 first hour
      hourlyRate: 5000, // ₹50 per hour
      dailyMaxRate: 50000, // ₹500 max
      isActive: true,
      priority: 2,
    },
  })

  await prisma.pricingRule.create({
    data: {
      parkingLotId: mallLot.id,
      name: 'Two Wheeler',
      zoneTypes: ['TWO_WHEELER'],
      vehicleTypes: ['MOTORCYCLE'],
      pricingModel: 'FLAT_RATE',
      baseRate: 2000, // ₹20 flat
      isActive: true,
      priority: 1,
    },
  })

  await prisma.pricingRule.create({
    data: {
      parkingLotId: mallLot.id,
      name: 'EV Charging (includes power)',
      zoneTypes: ['EV_CHARGING'],
      vehicleTypes: ['CAR', 'SUV'],
      pricingModel: 'HOURLY',
      baseRate: 15000, // ₹150 first hour (includes charging)
      hourlyRate: 10000, // ₹100 per hour
      isActive: true,
      priority: 2,
    },
  })

  await prisma.pricingRule.create({
    data: {
      parkingLotId: mallLot.id,
      name: 'Staff Parking',
      zoneTypes: ['STAFF'],
      vehicleTypes: ['CAR', 'SUV', 'MOTORCYCLE'],
      pricingModel: 'FREE',
      baseRate: 0,
      isActive: true,
      priority: 3,
    },
  })
  console.log('✅ Pricing rules created: 5')

  // ================================================
  // VEHICLES
  // ================================================
  for (const v of DEMO_VEHICLES) {
    await prisma.vehicle.upsert({
      where: { licensePlate: v.plate },
      update: {},
      create: {
        licensePlate: v.plate,
        vehicleType: v.type as any,
        make: v.make,
        model: v.model,
        color: v.color,
        visitCount: Math.floor(Math.random() * 100) + 1,
        lastVisitAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
        isVip: v.plate.includes('VIP') || Math.random() > 0.9,
        isBlacklisted: false,
      },
    })
  }
  console.log('✅ Vehicles created:', DEMO_VEHICLES.length)

  // ================================================
  // ACTIVE TOKENS (Current Parked Vehicles)
  // ================================================
  const occupiedSlots = await prisma.slot.findMany({
    where: {
      zone: { parkingLotId: mallLot.id },
      isOccupied: true,
    },
    take: 50,
    include: { zone: true },
  })

  let tokenNum = 1000
  for (const slot of occupiedSlots) {
    const vehicle = DEMO_VEHICLES[Math.floor(Math.random() * DEMO_VEHICLES.length)]
    const entryTime = new Date(Date.now() - Math.random() * 6 * 60 * 60 * 1000) // 0-6 hours ago

    await prisma.token.upsert({
      where: { tokenNumber: `PMC${tokenNum}` },
      update: {},
      create: {
        parkingLotId: mallLot.id,
        tokenNumber: `PMC${tokenNum}`,
        tokenType: 'QR_CODE',
        qrCode: `QR-PMC${tokenNum}-${Date.now()}`,
        allocatedSlotId: slot.id,
        licensePlate: vehicle.plate,
        vehicleType: vehicle.type as any,
        entryTime,
        status: 'ACTIVE',
      },
    })
    tokenNum++
  }
  console.log('✅ Active parking tokens created:', occupiedSlots.length)

  // ================================================
  // HISTORICAL TRANSACTIONS (Last 30 days)
  // ================================================
  const historicalTokens = []
  for (let day = 0; day < 30; day++) {
    const transactionsPerDay = 150 + Math.floor(Math.random() * 100) // 150-250 per day

    for (let t = 0; t < transactionsPerDay; t++) {
      const date = new Date()
      date.setDate(date.getDate() - day)
      date.setHours(6 + Math.floor(Math.random() * 16)) // 6am - 10pm
      date.setMinutes(Math.floor(Math.random() * 60))

      const duration = 30 + Math.floor(Math.random() * 300) // 30-330 minutes
      const exitTime = new Date(date.getTime() + duration * 60 * 1000)

      const vehicle = DEMO_VEHICLES[Math.floor(Math.random() * DEMO_VEHICLES.length)]
      const baseAmount = vehicle.type === 'MOTORCYCLE' ? 2000 : 4000 + Math.floor(duration / 60) * 2000

      historicalTokens.push({
        parkingLotId: mallLot.id,
        tokenNumber: `PMC-H${day * 1000 + t}`,
        tokenType: 'QR_CODE' as const,
        licensePlate: vehicle.plate,
        vehicleType: vehicle.type as any,
        entryTime: date,
        exitTime,
        status: 'COMPLETED' as const,
      })
    }
  }

  // Insert in batches
  const batchSize = 500
  for (let i = 0; i < historicalTokens.length; i += batchSize) {
    const batch = historicalTokens.slice(i, i + batchSize)
    await prisma.token.createMany({
      data: batch,
      skipDuplicates: true,
    })
  }
  console.log('✅ Historical tokens created:', historicalTokens.length)

  // ================================================
  // ALERT RULES
  // ================================================
  await prisma.alertRule.upsert({
    where: { id: 'alert-high-occupancy' },
    update: {},
    create: {
      id: 'alert-high-occupancy',
      name: 'High Occupancy Alert',
      description: 'Notify when parking occupancy exceeds 85%',
      metric: 'occupancy_rate',
      operator: 'gt',
      threshold: 85,
      notifyEmail: true,
      notifyPush: true,
      cooldownMinutes: 30,
      isActive: true,
    },
  })

  await prisma.alertRule.upsert({
    where: { id: 'alert-camera-offline' },
    update: {},
    create: {
      id: 'alert-camera-offline',
      name: 'Camera Offline Alert',
      description: 'Notify when any camera goes offline',
      metric: 'camera_offline',
      operator: 'gt',
      threshold: 0,
      notifyEmail: true,
      cooldownMinutes: 10,
      isActive: true,
    },
  })

  await prisma.alertRule.upsert({
    where: { id: 'alert-gate-error' },
    update: {},
    create: {
      id: 'alert-gate-error',
      name: 'Gate Error Alert',
      description: 'Notify when gate has an error',
      metric: 'gate_error',
      operator: 'gt',
      threshold: 0,
      notifyEmail: true,
      notifySms: true,
      cooldownMinutes: 5,
      isActive: true,
    },
  })

  await prisma.alertRule.upsert({
    where: { id: 'alert-payment-failures' },
    update: {},
    create: {
      id: 'alert-payment-failures',
      name: 'Payment Failure Spike',
      description: 'Alert when payment failures exceed threshold',
      metric: 'payment_failed',
      operator: 'gt',
      threshold: 5,
      notifyEmail: true,
      cooldownMinutes: 15,
      isActive: true,
    },
  })
  console.log('✅ Alert rules created: 4')

  // ================================================
  // WALLETS
  // ================================================
  await prisma.wallet.upsert({
    where: { userId: adminUser.id },
    update: {},
    create: {
      userId: adminUser.id,
      balance: BigInt(10000000), // ₹1,00,000
      currency: 'INR',
      walletType: 'PERSONAL',
      status: 'ACTIVE',
      isVerified: true,
      verifiedAt: new Date(),
      kycLevel: 'FULL',
    },
  })

  const merchantWallet = await prisma.wallet.upsert({
    where: { parkingLotId: mallLot.id },
    update: {},
    create: {
      parkingLotId: mallLot.id,
      balance: BigInt(500000000), // ₹50,00,000
      currency: 'INR',
      walletType: 'MERCHANT',
      status: 'ACTIVE',
      isVerified: true,
      verifiedAt: new Date(),
      kycLevel: 'FULL',
    },
  })

  // Create sandbox config for merchant wallet
  await prisma.sandboxConfig.upsert({
    where: { walletId: merchantWallet.id },
    update: {},
    create: {
      walletId: merchantWallet.id,
      autoApproveDeposits: true,
      autoApproveWithdrawals: true,
      simulateFailures: false,
      failureRate: 0.05,
      processingDelay: 1000,
      testBankBalance: BigInt(100000000000), // ₹100 crore
    },
  })
  console.log('✅ Wallets created: 2')

  // ================================================
  // PARKING LOT ASSIGNMENTS
  // ================================================
  const users = [adminUser, operatorUser, viewerUser]
  for (const user of users) {
    await prisma.parkingLotAssignment.upsert({
      where: {
        userId_parkingLotId: {
          userId: user.id,
          parkingLotId: mallLot.id,
        },
      },
      update: {},
      create: {
        userId: user.id,
        parkingLotId: mallLot.id,
      },
    })
  }
  console.log('✅ User assignments created')

  // ================================================
  // FINAL SUMMARY
  // ================================================
  console.log('')
  console.log('═══════════════════════════════════════════════════')
  console.log('🎉 PRODUCTION DEMO DATABASE SEEDING COMPLETE!')
  console.log('═══════════════════════════════════════════════════')
  console.log('')
  console.log('📍 Parking Lot: Phoenix MarketCity')
  console.log(`   Total Slots: ${totalSlots}`)
  console.log(`   Zones: ${zoneConfigs.length}`)
  console.log(`   Cameras: ${cameraConfigs.length}`)
  console.log('')
  console.log('🔐 Demo Credentials:')
  console.log('   ┌────────────────────────────────────────┐')
  console.log('   │ Admin:    admin@demo.sparking.io      │')
  console.log('   │ Operator: operator@demo.sparking.io   │')
  console.log('   │ Viewer:   viewer@demo.sparking.io     │')
  console.log('   │ Password: demo123                     │')
  console.log('   └────────────────────────────────────────┘')
  console.log('')
  console.log('💳 Sandbox Payment:')
  console.log('   Test Card: 4111 1111 1111 1111')
  console.log('   Expiry: 12/28  CVV: 123')
  console.log('   UPI: success@upi')
  console.log('')
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
