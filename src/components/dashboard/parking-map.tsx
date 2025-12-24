'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface Slot {
  id: string
  slotNumber: string
  positionX: number
  positionY: number
  width: number
  height: number
  rotation: number
  isOccupied: boolean
  status: string
  slotType: string
}

interface Zone {
  id: string
  name: string
  code: string
  color: string
  level: number
  slots: Slot[]
}

interface ParkingMapProps {
  zones?: Zone[]
  selectedZone?: string
  onSlotClick?: (slot: Slot) => void
}

// Mock data for demonstration
const mockZones: Zone[] = [
  {
    id: '1',
    name: 'Ground Floor - Section A',
    code: 'GF-A',
    color: '#3B82F6',
    level: 0,
    slots: Array.from({ length: 20 }, (_, i) => ({
      id: `slot-a-${i + 1}`,
      slotNumber: `A${String(i + 1).padStart(2, '0')}`,
      positionX: (i % 5) * 70 + 20,
      positionY: Math.floor(i / 5) * 120 + 20,
      width: 60,
      height: 100,
      rotation: 0,
      isOccupied: Math.random() > 0.4,
      status: Math.random() > 0.9 ? 'MAINTENANCE' : 'AVAILABLE',
      slotType: i === 0 ? 'HANDICAPPED' : i === 19 ? 'EV_CHARGING' : 'STANDARD',
    })),
  },
  {
    id: '2',
    name: 'Ground Floor - Section B',
    code: 'GF-B',
    color: '#10B981',
    level: 0,
    slots: Array.from({ length: 15 }, (_, i) => ({
      id: `slot-b-${i + 1}`,
      slotNumber: `B${String(i + 1).padStart(2, '0')}`,
      positionX: (i % 5) * 70 + 400,
      positionY: Math.floor(i / 5) * 120 + 20,
      width: 60,
      height: 100,
      rotation: 0,
      isOccupied: Math.random() > 0.5,
      status: 'AVAILABLE',
      slotType: 'STANDARD',
    })),
  },
]

export function ParkingMap({ zones = mockZones, selectedZone, onSlotClick }: ParkingMapProps) {
  const [activeSlot, setActiveSlot] = useState<Slot | null>(null)
  const [scale, setScale] = useState(1)

  const getSlotColor = (slot: Slot) => {
    if (slot.status === 'MAINTENANCE') return 'bg-yellow-500'
    if (slot.status === 'BLOCKED') return 'bg-gray-500'
    if (slot.isOccupied) return 'bg-red-500'
    if (slot.slotType === 'HANDICAPPED') return 'bg-blue-500'
    if (slot.slotType === 'EV_CHARGING') return 'bg-green-500'
    return 'bg-emerald-400'
  }

  const getSlotIcon = (slot: Slot) => {
    if (slot.slotType === 'HANDICAPPED') return '♿'
    if (slot.slotType === 'EV_CHARGING') return '⚡'
    if (slot.isOccupied) return '🚗'
    return ''
  }

  const filteredZones = selectedZone
    ? zones.filter(z => z.id === selectedZone)
    : zones

  const totalSlots = filteredZones.reduce((acc, z) => acc + z.slots.length, 0)
  const occupiedSlots = filteredZones.reduce((acc, z) => acc + z.slots.filter(s => s.isOccupied).length, 0)
  const availableSlots = totalSlots - occupiedSlots

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Live Parking Map</CardTitle>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setScale(s => Math.max(0.5, s - 0.1))}
              className="px-2 py-1 text-sm bg-muted rounded hover:bg-muted/80"
            >
              −
            </button>
            <span className="text-sm text-muted-foreground">{Math.round(scale * 100)}%</span>
            <button
              onClick={() => setScale(s => Math.min(2, s + 0.1))}
              className="px-2 py-1 text-sm bg-muted rounded hover:bg-muted/80"
            >
              +
            </button>
          </div>
        </div>
        <div className="flex gap-4 text-sm">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-emerald-400" />
            <span>Available ({availableSlots})</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-red-500" />
            <span>Occupied ({occupiedSlots})</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-yellow-500" />
            <span>Maintenance</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-blue-500" />
            <span>Accessible</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-green-500" />
            <span>EV Charging</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0 relative">
        <div className="overflow-auto bg-slate-100 dark:bg-slate-900 rounded-b-lg" style={{ height: '500px' }}>
          <div
            className="relative min-w-[800px] min-h-[500px] transition-transform"
            style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}
          >
            {/* Driving lanes */}
            <div className="absolute top-0 left-[370px] w-[20px] h-full bg-slate-300 dark:bg-slate-700" />
            <div className="absolute top-[240px] left-0 w-full h-[20px] bg-slate-300 dark:bg-slate-700" />

            {/* Entry/Exit markers */}
            <div className="absolute top-[230px] left-[10px] bg-green-600 text-white text-xs px-2 py-1 rounded">
              ENTRY →
            </div>
            <div className="absolute top-[230px] right-[10px] bg-red-600 text-white text-xs px-2 py-1 rounded">
              ← EXIT
            </div>

            {filteredZones.map((zone) => (
              <div key={zone.id} className="absolute">
                {/* Zone label */}
                <div
                  className="absolute -top-6 left-0 text-xs font-semibold px-2 py-0.5 rounded"
                  style={{
                    backgroundColor: zone.color,
                    color: 'white',
                    left: zone.slots[0]?.positionX || 0
                  }}
                >
                  {zone.code}
                </div>

                {zone.slots.map((slot) => (
                  <div
                    key={slot.id}
                    className={cn(
                      'absolute flex items-center justify-center cursor-pointer transition-all border-2 border-white dark:border-slate-800 rounded-sm shadow-sm hover:shadow-lg hover:scale-105',
                      getSlotColor(slot)
                    )}
                    style={{
                      left: slot.positionX,
                      top: slot.positionY,
                      width: slot.width,
                      height: slot.height,
                      transform: `rotate(${slot.rotation}deg)`,
                    }}
                    onClick={() => {
                      setActiveSlot(slot)
                      onSlotClick?.(slot)
                    }}
                    title={`${slot.slotNumber} - ${slot.isOccupied ? 'Occupied' : 'Available'}`}
                  >
                    <div className="text-center text-white">
                      <div className="text-lg">{getSlotIcon(slot)}</div>
                      <div className="text-[10px] font-bold">{slot.slotNumber}</div>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Slot details popup */}
        {activeSlot && (
          <div className="absolute bottom-4 right-4 bg-background border rounded-lg shadow-lg p-4 min-w-[200px]">
            <div className="flex justify-between items-start mb-2">
              <h4 className="font-semibold">Slot {activeSlot.slotNumber}</h4>
              <button
                onClick={() => setActiveSlot(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status:</span>
                <Badge variant={activeSlot.isOccupied ? 'destructive' : 'default'}>
                  {activeSlot.isOccupied ? 'Occupied' : 'Available'}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Type:</span>
                <span>{activeSlot.slotType}</span>
              </div>
              {activeSlot.isOccupied && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Since:</span>
                  <span>2h 15m ago</span>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
