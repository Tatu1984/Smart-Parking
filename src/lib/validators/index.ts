import { z } from 'zod'

// Common validators
export const idSchema = z.string().cuid()

// Organization schemas
export const createOrganizationSchema = z.object({
  name: z.string().min(2).max(100),
  slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/),
  logo: z.string().url().optional(),
})

// User schemas
export const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2).max(100),
  phone: z.string().optional(),
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'OPERATOR', 'AUDITOR', 'VIEWER']).default('OPERATOR'),
  organizationId: z.string().cuid(),
})

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export const updateUserSchema = z.object({
  email: z.string().email().optional(),
  name: z.string().min(2).max(100).optional(),
  phone: z.string().optional().nullable(),
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'OPERATOR', 'AUDITOR', 'VIEWER']).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional(),
  avatar: z.string().url().optional().nullable(),
})

// Parking Lot schemas
export const createParkingLotSchema = z.object({
  name: z.string().min(2).max(100),
  slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/),
  venueType: z.enum(['AIRPORT', 'MALL', 'CINEMA', 'COMMERCIAL', 'HOSPITAL', 'STADIUM', 'HOTEL', 'RESIDENTIAL', 'OTHER']),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().default('India'),
  postalCode: z.string().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  timezone: z.string().default('Asia/Kolkata'),
  hasEvCharging: z.boolean().default(false),
  hasValetService: z.boolean().default(false),
  hasMultiLevel: z.boolean().default(false),
  operatingHours: z.record(z.string(), z.object({
    open: z.string(),
    close: z.string(),
  })).optional(),
})

export const updateParkingLotSchema = createParkingLotSchema.partial()

// Zone schemas
export const createZoneSchema = z.object({
  parkingLotId: z.string().cuid(),
  name: z.string().min(1).max(100),
  code: z.string().min(1).max(10).regex(/^[A-Z0-9-]+$/i),
  level: z.number().int().default(0),
  zoneType: z.enum(['GENERAL', 'VIP', 'EV_CHARGING', 'DISABLED', 'STAFF', 'VISITOR', 'SHORT_TERM', 'LONG_TERM', 'TWO_WHEELER', 'VALET', 'RESERVED']).default('GENERAL'),
  description: z.string().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#3182CE'),
  sortOrder: z.number().int().default(0),
})

export const updateZoneSchema = createZoneSchema.partial().omit({ parkingLotId: true })

// Slot schemas
export const createSlotSchema = z.object({
  zoneId: z.string().cuid(),
  slotNumber: z.string().min(1).max(20),
  positionX: z.number().default(0),
  positionY: z.number().default(0),
  width: z.number().positive().default(50),
  height: z.number().positive().default(100),
  rotation: z.number().min(0).max(360).default(0),
  detectionBounds: z.object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    width: z.number().min(0).max(1),
    height: z.number().min(0).max(1),
  }).optional(),
  cameraId: z.string().cuid().optional(),
  slotType: z.enum(['STANDARD', 'COMPACT', 'LARGE', 'HANDICAPPED', 'EV_CHARGING', 'MOTORCYCLE', 'VIP', 'RESERVED']).default('STANDARD'),
  vehicleType: z.enum(['CAR', 'SUV', 'MOTORCYCLE', 'BUS', 'TRUCK', 'VAN', 'BICYCLE', 'ANY']).default('CAR'),
  hasEvCharger: z.boolean().default(false),
  hasRoof: z.boolean().default(false),
  isAccessible: z.boolean().default(false),
})

export const updateSlotSchema = createSlotSchema.partial().omit({ zoneId: true }).extend({
  isOccupied: z.boolean().optional(),
  status: z.enum(['AVAILABLE', 'OCCUPIED', 'RESERVED', 'MAINTENANCE', 'BLOCKED']).optional(),
})

export const bulkCreateSlotsSchema = z.object({
  zoneId: z.string().cuid(),
  prefix: z.string().min(1).max(10),
  startNumber: z.number().int().positive(),
  count: z.number().int().positive().max(200),
  slotType: z.enum(['STANDARD', 'COMPACT', 'LARGE', 'HANDICAPPED', 'EV_CHARGING', 'MOTORCYCLE', 'VIP', 'RESERVED']).default('STANDARD'),
  vehicleType: z.enum(['CAR', 'SUV', 'MOTORCYCLE', 'BUS', 'TRUCK', 'VAN', 'BICYCLE', 'ANY']).default('CAR'),
})

// Camera schemas
export const createCameraSchema = z.object({
  parkingLotId: z.string().cuid(),
  zoneId: z.string().cuid().optional(),
  name: z.string().min(1).max(100),
  rtspUrl: z.string().url(),
  onvifUrl: z.string().url().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  positionDescription: z.string().optional(),
  coverageSlots: z.number().int().positive().default(10),
  hasIR: z.boolean().default(false),
  hasPTZ: z.boolean().default(false),
})

export const updateCameraSchema = createCameraSchema.partial().omit({ parkingLotId: true })

// Token schemas
export const createTokenSchema = z.object({
  parkingLotId: z.string().cuid(),
  tokenType: z.enum(['QR_CODE', 'RFID', 'BARCODE', 'ANPR', 'MANUAL']).default('QR_CODE'),
  licensePlate: z.string().optional(),
  vehicleType: z.enum(['CAR', 'SUV', 'MOTORCYCLE', 'BUS', 'TRUCK', 'VAN', 'BICYCLE', 'ANY']).optional(),
  expectedDuration: z.number().int().positive().optional(),
})

export const completeTokenSchema = z.object({
  tokenId: z.string().cuid(),
  paymentMethod: z.enum(['CASH', 'CARD', 'UPI', 'WALLET', 'POSTPAID', 'FREE']).optional(),
  paymentRef: z.string().optional(),
})

// Pricing Rule schemas
export const createPricingRuleSchema = z.object({
  parkingLotId: z.string().cuid(),
  name: z.string().min(1).max(100),
  zoneTypes: z.array(z.enum(['GENERAL', 'VIP', 'EV_CHARGING', 'DISABLED', 'STAFF', 'VISITOR', 'SHORT_TERM', 'LONG_TERM', 'TWO_WHEELER', 'VALET', 'RESERVED'])),
  vehicleTypes: z.array(z.enum(['CAR', 'SUV', 'MOTORCYCLE', 'BUS', 'TRUCK', 'VAN', 'BICYCLE', 'ANY'])),
  pricingModel: z.enum(['FLAT_RATE', 'HOURLY', 'SLAB', 'DYNAMIC', 'FREE']),
  baseRate: z.number().int().nonnegative(),
  hourlyRate: z.number().int().nonnegative().optional(),
  dailyMaxRate: z.number().int().nonnegative().optional(),
  slabs: z.array(z.object({
    upToHours: z.number().positive(),
    rate: z.number().nonnegative(),
  })).optional(),
  peakHourMultiplier: z.number().positive().default(1.0),
  peakHours: z.object({
    start: z.string(),
    end: z.string(),
  }).optional(),
  isActive: z.boolean().default(true),
  validFrom: z.string().datetime().optional(),
  validUntil: z.string().datetime().optional(),
  priority: z.number().int().default(0),
})

// Gate schemas
export const createGateSchema = z.object({
  parkingLotId: z.string().cuid(),
  name: z.string().min(1).max(100),
  gateType: z.enum(['ENTRY', 'EXIT', 'BIDIRECTIONAL']),
  controllerType: z.string().optional(),
  controllerAddress: z.string().optional(),
})

// Allocation request schema
export const slotAllocationSchema = z.object({
  parkingLotId: z.string().cuid(),
  vehicleType: z.enum(['CAR', 'SUV', 'MOTORCYCLE', 'BUS', 'TRUCK', 'VAN', 'BICYCLE', 'ANY']).optional(),
  preferredZoneType: z.enum(['GENERAL', 'VIP', 'EV_CHARGING', 'DISABLED', 'STAFF', 'VISITOR', 'SHORT_TERM', 'LONG_TERM', 'TWO_WHEELER', 'VALET', 'RESERVED']).optional(),
  isAccessible: z.boolean().optional(),
  needsEvCharging: z.boolean().optional(),
})

// AI Detection event schema
export const detectionEventSchema = z.object({
  cameraId: z.string().cuid(),
  eventType: z.enum(['VEHICLE_DETECTED', 'VEHICLE_ENTERED_SLOT', 'VEHICLE_LEFT_SLOT', 'SLOT_OCCUPIED', 'SLOT_VACATED', 'LICENSE_PLATE_READ', 'ANOMALY_DETECTED']),
  objectType: z.string(),
  confidence: z.number().min(0).max(1),
  bbox: z.object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    width: z.number().min(0).max(1),
    height: z.number().min(0).max(1),
  }),
  trackingId: z.string().optional(),
  vehicleType: z.string().optional(),
  vehicleColor: z.string().optional(),
  licensePlate: z.string().optional(),
  frameUrl: z.string().url().optional(),
})
