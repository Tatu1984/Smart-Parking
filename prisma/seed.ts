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

async function main() {
  console.log('Seeding database...')

  // Create organization
  const org = await prisma.organization.upsert({
    where: { slug: 'sparking-demo' },
    update: {},
    create: {
      name: 'SParking Demo',
      slug: 'sparking-demo',
    },
  })
  console.log('Created organization:', org.name)

  // Create admin user
  const passwordHash = await bcrypt.hash('admin123', 12)
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@sparking.io' },
    update: {},
    create: {
      email: 'admin@sparking.io',
      name: 'Admin User',
      passwordHash,
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
      organizationId: org.id,
    },
  })
  console.log('Created admin user:', adminUser.email)

  // Create a demo parking lot
  const parkingLot = await prisma.parkingLot.upsert({
    where: {
      organizationId_slug: {
        organizationId: org.id,
        slug: 'demo-mall-parking'
      }
    },
    update: {},
    create: {
      name: 'Demo Mall Parking',
      slug: 'demo-mall-parking',
      venueType: 'MALL',
      status: 'ACTIVE',
      address: '123 Demo Street',
      city: 'Bangalore',
      state: 'Karnataka',
      country: 'India',
      postalCode: '560001',
      timezone: 'Asia/Kolkata',
      currency: 'INR',
      hasEvCharging: true,
      hasValetService: true,
      hasMultiLevel: true,
      totalSlots: 0,
      organizationId: org.id,
    },
  })
  console.log('Created parking lot:', parkingLot.name)

  // Create zones
  const zones = [
    { name: 'Ground Floor - General', code: 'GF-A', level: 0, zoneType: 'GENERAL' as const, color: '#3182CE' },
    { name: 'Ground Floor - VIP', code: 'GF-VIP', level: 0, zoneType: 'VIP' as const, color: '#9F7AEA' },
    { name: 'Level 1 - General', code: 'L1-A', level: 1, zoneType: 'GENERAL' as const, color: '#38A169' },
    { name: 'Level 1 - EV Charging', code: 'L1-EV', level: 1, zoneType: 'EV_CHARGING' as const, color: '#38B2AC' },
    { name: 'Level 2 - General', code: 'L2-A', level: 2, zoneType: 'GENERAL' as const, color: '#DD6B20' },
  ]

  for (const zoneData of zones) {
    const zone = await prisma.zone.upsert({
      where: {
        parkingLotId_code: {
          parkingLotId: parkingLot.id,
          code: zoneData.code
        }
      },
      update: {},
      create: {
        ...zoneData,
        parkingLotId: parkingLot.id,
      },
    })
    console.log('Created zone:', zone.name)

    // Create slots for each zone
    const slotCount = zoneData.zoneType === 'VIP' ? 10 : 20
    for (let i = 1; i <= slotCount; i++) {
      await prisma.slot.upsert({
        where: {
          zoneId_slotNumber: {
            zoneId: zone.id,
            slotNumber: `${zoneData.code}-${String(i).padStart(2, '0')}`
          }
        },
        update: {},
        create: {
          zoneId: zone.id,
          slotNumber: `${zoneData.code}-${String(i).padStart(2, '0')}`,
          slotType: zoneData.zoneType === 'EV_CHARGING' ? 'EV_CHARGING' : 'STANDARD',
          vehicleType: 'CAR',
          hasEvCharger: zoneData.zoneType === 'EV_CHARGING',
          status: 'AVAILABLE',
          isOccupied: false,
        },
      })
    }
    console.log(`Created ${slotCount} slots for zone ${zoneData.code}`)
  }

  // Update parking lot total slots
  const totalSlots = await prisma.slot.count({
    where: { zone: { parkingLotId: parkingLot.id } },
  })
  await prisma.parkingLot.update({
    where: { id: parkingLot.id },
    data: { totalSlots },
  })
  console.log('Updated parking lot total slots:', totalSlots)

  // Create a pricing rule (delete existing first to avoid duplicates)
  await prisma.pricingRule.deleteMany({
    where: { parkingLotId: parkingLot.id }
  })
  await prisma.pricingRule.create({
    data: {
      parkingLotId: parkingLot.id,
      name: 'Standard Hourly',
      pricingModel: 'HOURLY',
      baseRate: 20,
      hourlyRate: 20,
      dailyMaxRate: 200,
      zoneTypes: ['GENERAL'],
      vehicleTypes: ['CAR', 'SUV'],
      isActive: true,
      priority: 1,
    },
  })
  console.log('Created pricing rule')

  console.log('Seeding completed!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
