'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { ZoneOccupancy } from '@/types'

interface ZoneOccupancyCardProps {
  zones: ZoneOccupancy[]
}

export function ZoneOccupancyCard({ zones }: ZoneOccupancyCardProps) {
  const getOccupancyColor = (rate: number) => {
    if (rate >= 90) return 'text-red-500'
    if (rate >= 70) return 'text-yellow-500'
    return 'text-green-500'
  }

  const getProgressColor = (rate: number) => {
    if (rate >= 90) return 'bg-red-500'
    if (rate >= 70) return 'bg-yellow-500'
    return 'bg-green-500'
  }

  const getStatusBadge = (rate: number) => {
    if (rate >= 90) return { label: 'Full', variant: 'destructive' as const }
    if (rate >= 70) return { label: 'Busy', variant: 'secondary' as const }
    return { label: 'Available', variant: 'default' as const }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Zone Occupancy</CardTitle>
        <CardDescription>Real-time availability by zone</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {zones.map((zone) => {
            const status = getStatusBadge(zone.occupancyRate)
            return (
              <div key={zone.zoneId} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{zone.zoneName}</span>
                    <Badge variant="outline" className="text-xs">
                      {zone.zoneCode}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={status.variant}>{status.label}</Badge>
                    <span
                      className={cn(
                        'text-sm font-semibold',
                        getOccupancyColor(zone.occupancyRate)
                      )}
                    >
                      {zone.occupancyRate.toFixed(0)}%
                    </span>
                  </div>
                </div>
                <Progress
                  value={zone.occupancyRate}
                  className={cn('h-2', getProgressColor(zone.occupancyRate))}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{zone.occupiedSlots} occupied</span>
                  <span>{zone.availableSlots} available</span>
                  <span>{zone.totalSlots} total</span>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
