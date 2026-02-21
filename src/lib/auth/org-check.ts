/**
 * Organization/Tenant isolation checks.
 * Ensures users can only access resources belonging to their organization.
 */

import prisma from '@/lib/db'

interface AuthUser {
  id: string
  role: string
  organizationId: string
}

/** SUPER_ADMIN bypasses all org checks */
function isSuperAdmin(user: AuthUser): boolean {
  return user.role === 'SUPER_ADMIN'
}

/** Generic check: does the resource belong to the user's org? */
export function checkResourceAccess(user: AuthUser, resourceOrgId: string): boolean {
  if (isSuperAdmin(user)) return true
  return user.organizationId === resourceOrgId
}

/** Verify a parking lot belongs to the user's org */
export async function checkParkingLotAccess(user: AuthUser, lotId: string): Promise<boolean> {
  if (isSuperAdmin(user)) return true

  const lot = await prisma.parkingLot.findUnique({
    where: { id: lotId },
    select: { organizationId: true },
  })

  if (!lot) return false
  return lot.organizationId === user.organizationId
}

/** Verify a zone belongs to the user's org (via its parking lot) */
export async function checkZoneAccess(user: AuthUser, zoneId: string): Promise<boolean> {
  if (isSuperAdmin(user)) return true

  const zone = await prisma.zone.findUnique({
    where: { id: zoneId },
    select: { parkingLot: { select: { organizationId: true } } },
  })

  if (!zone) return false
  return zone.parkingLot.organizationId === user.organizationId
}

/** Verify a slot belongs to the user's org (via zone → parking lot) */
export async function checkSlotAccess(user: AuthUser, slotId: string): Promise<boolean> {
  if (isSuperAdmin(user)) return true

  const slot = await prisma.slot.findUnique({
    where: { id: slotId },
    select: { zone: { select: { parkingLot: { select: { organizationId: true } } } } },
  })

  if (!slot) return false
  return slot.zone.parkingLot.organizationId === user.organizationId
}
