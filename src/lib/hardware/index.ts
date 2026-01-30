/**
 * Hardware Integration Library
 * Provides drivers for gates, displays, and other parking hardware
 */

import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'

// ============================================
// GATE CONTROLLER
// ============================================

export type GateProtocol = 'RS485' | 'RELAY' | 'HTTP' | 'MQTT'

export interface GateCommand {
  action: 'OPEN' | 'CLOSE' | 'STATUS'
  gateId: string
  duration?: number // milliseconds to keep open
}

export interface GateStatus {
  gateId: string
  status: 'OPEN' | 'CLOSED' | 'ERROR' | 'MAINTENANCE'
  lastActionAt: Date
  isOnline: boolean
}

export class GateController {
  private gateId: string
  private protocol: GateProtocol
  private address: string
  private port?: number
  private connected: boolean = false

  // Public properties for API access
  public id: string
  public name: string = ''
  public type: GateProtocol

  constructor(gateId: string, protocol: GateProtocol, address: string, port?: number) {
    this.gateId = gateId
    this.id = gateId
    this.protocol = protocol
    this.type = protocol
    this.address = address
    this.port = port
  }

  async stop(): Promise<boolean> {
    // Emergency stop - typically stops gate motion
    return this.sendCommand('STOP')
  }

  async disconnect(): Promise<void> {
    this.connected = false
  }

  async open(duration: number = 5000): Promise<boolean> {
    try {
      const success = await this.sendCommand('OPEN')

      if (success) {
        // Log gate event
        await prisma.gateEvent.create({
          data: {
            gateId: this.gateId,
            action: 'OPENED',
            triggeredBy: 'system'
          }
        })

        // Update gate status
        await prisma.gate.update({
          where: { id: this.gateId },
          data: {
            status: 'OPEN',
            lastActionAt: new Date()
          }
        })

        // Schedule auto-close
        if (duration > 0) {
          setTimeout(() => this.close(), duration)
        }
      }

      return success
    } catch (error) {
      logger.error(`Gate ${this.gateId} open error:`, error)
      return false
    }
  }

  async close(): Promise<boolean> {
    try {
      const success = await this.sendCommand('CLOSE')

      if (success) {
        await prisma.gateEvent.create({
          data: {
            gateId: this.gateId,
            action: 'CLOSED',
            triggeredBy: 'system'
          }
        })

        await prisma.gate.update({
          where: { id: this.gateId },
          data: {
            status: 'CLOSED',
            lastActionAt: new Date()
          }
        })
      }

      return success
    } catch (error) {
      logger.error(`Gate ${this.gateId} close error:`, error)
      return false
    }
  }

  async getStatus(): Promise<GateStatus | null> {
    try {
      const gate = await prisma.gate.findUnique({
        where: { id: this.gateId }
      })

      if (!gate) return null

      return {
        gateId: this.gateId,
        status: gate.status as GateStatus['status'],
        lastActionAt: gate.lastActionAt || new Date(),
        isOnline: await this.ping()
      }
    } catch {
      return null
    }
  }

  private async sendCommand(command: 'OPEN' | 'CLOSE' | 'STATUS' | 'STOP'): Promise<boolean> {
    switch (this.protocol) {
      case 'HTTP':
        return this.sendHttpCommand(command)
      case 'RS485':
        return this.sendRS485Command(command)
      case 'RELAY':
        return this.sendRelayCommand(command)
      case 'MQTT':
        return this.sendMqttCommand(command)
      default:
        logger.error(`Unknown protocol: ${this.protocol}`)
        return false
    }
  }

  private async sendHttpCommand(command: string): Promise<boolean> {
    try {
      const url = `${this.address}/${command.toLowerCase()}`
      const response = await fetch(url, { method: 'POST', signal: AbortSignal.timeout(5000) })
      return response.ok
    } catch {
      return false
    }
  }

  private async sendRS485Command(command: string): Promise<boolean> {
    // RS-485 command format: [STX][ADDR][CMD][CHECKSUM][ETX]
    const STX = 0x02
    const ETX = 0x03
    const addr = parseInt(this.address, 16) || 0x01
    const cmd = command === 'OPEN' ? 0x01 : command === 'CLOSE' ? 0x02 : 0x00
    const checksum = (addr + cmd) & 0xFF

    const buffer = Buffer.from([STX, addr, cmd, checksum, ETX])

    // In production, this would use a serial port library
    // For now, log the command that would be sent
    logger.debug(`RS485 Command to ${this.address}: ${buffer.toString('hex')}`)

    // Simulate success - in production would await actual hardware response
    return true
  }

  private async sendRelayCommand(command: string): Promise<boolean> {
    // Relay control via GPIO or network relay controller
    const state = command === 'OPEN' ? 1 : 0
    logger.debug(`Relay at ${this.address}: Set to ${state}`)
    return true
  }

  private async sendMqttCommand(command: string): Promise<boolean> {
    // MQTT command to gate topic
    const topic = `gates/${this.gateId}/command`
    logger.debug(`MQTT to ${topic}: ${command}`)
    return true
  }

  private async ping(): Promise<boolean> {
    try {
      if (this.protocol === 'HTTP') {
        const response = await fetch(`${this.address}/status`, {
          method: 'GET',
          signal: AbortSignal.timeout(2000)
        })
        return response.ok
      }
      return true // Assume online for non-HTTP protocols
    } catch {
      return false
    }
  }
}

// ============================================
// LED DISPLAY CONTROLLER
// ============================================

export type DisplayProtocol = 'SERIAL' | 'HTTP' | 'UDP'

export interface DisplayMessage {
  line1?: string
  line2?: string
  line3?: string
  availableSlots?: number
  totalSlots?: number
  zoneInfo?: { name: string; available: number }[]
}

export class DisplayController {
  private displayId: string
  private protocol: DisplayProtocol
  private address: string
  private port?: number
  private connected: boolean = false

  // Public properties for API access
  public id: string
  public name: string = ''
  public type: DisplayProtocol

  constructor(displayId: string, protocol: DisplayProtocol, address: string, port?: number) {
    this.displayId = displayId
    this.id = displayId
    this.protocol = protocol
    this.type = protocol
    this.address = address
    this.port = port || 5000
  }

  async getStatus(): Promise<{ status: string; connected: boolean; currentMessage?: string }> {
    try {
      const display = await prisma.display.findUnique({
        where: { id: this.displayId }
      })
      return {
        status: display?.status || 'UNKNOWN',
        connected: this.connected,
        currentMessage: display?.currentMessage || undefined
      }
    } catch {
      return { status: 'UNKNOWN', connected: false }
    }
  }

  async showMessage(message: string): Promise<boolean> {
    return this.updateMessage({ line1: message })
  }

  async showZoneAvailability(zones: { name: string; available: number }[]): Promise<boolean> {
    return this.updateMessage({ zoneInfo: zones })
  }

  async clear(): Promise<boolean> {
    return this.updateMessage({ line1: '' })
  }

  async disconnect(): Promise<void> {
    this.connected = false
  }

  async updateMessage(message: DisplayMessage): Promise<boolean> {
    try {
      const formatted = this.formatMessage(message)
      const success = await this.sendToDisplay(formatted)

      if (success) {
        await prisma.display.update({
          where: { id: this.displayId },
          data: {
            currentMessage: formatted,
            status: 'ONLINE'
          }
        })
      }

      return success
    } catch (error) {
      logger.error(`Display ${this.displayId} update error:`, error)
      await prisma.display.update({
        where: { id: this.displayId },
        data: { status: 'ERROR' }
      })
      return false
    }
  }

  async updateAvailability(available: number, total: number): Promise<boolean> {
    return this.updateMessage({
      line1: 'PARKING AVAILABLE',
      line2: `${available} / ${total}`,
      availableSlots: available,
      totalSlots: total
    })
  }

  async showDirectionalArrow(direction: 'LEFT' | 'RIGHT' | 'STRAIGHT' | 'UP' | 'DOWN', message?: string): Promise<boolean> {
    const arrows: Record<string, string> = {
      LEFT: '◀',
      RIGHT: '▶',
      STRAIGHT: '▲',
      UP: '▲',
      DOWN: '▼'
    }

    return this.updateMessage({
      line1: arrows[direction] || '▲',
      line2: message || ''
    })
  }

  private formatMessage(message: DisplayMessage): string {
    const lines: string[] = []

    if (message.line1) lines.push(message.line1)
    if (message.line2) lines.push(message.line2)
    if (message.line3) lines.push(message.line3)

    if (message.availableSlots !== undefined && message.totalSlots !== undefined) {
      lines.push(`AVAILABLE: ${message.availableSlots}/${message.totalSlots}`)
    }

    if (message.zoneInfo) {
      for (const zone of message.zoneInfo) {
        lines.push(`${zone.name}: ${zone.available}`)
      }
    }

    return lines.join('\n')
  }

  private async sendToDisplay(content: string): Promise<boolean> {
    switch (this.protocol) {
      case 'HTTP':
        return this.sendHttpMessage(content)
      case 'UDP':
        return this.sendUdpMessage(content)
      case 'SERIAL':
        return this.sendSerialMessage(content)
      default:
        return false
    }
  }

  private async sendHttpMessage(content: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.address}/display`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
        signal: AbortSignal.timeout(5000)
      })
      return response.ok
    } catch {
      return false
    }
  }

  private async sendUdpMessage(content: string): Promise<boolean> {
    // UDP message - would use dgram in Node.js
    logger.debug(`UDP to ${this.address}:${this.port}: ${content}`)
    return true
  }

  private async sendSerialMessage(content: string): Promise<boolean> {
    // Serial message - would use serialport library
    logger.debug(`Serial to ${this.address}: ${content}`)
    return true
  }
}

// ============================================
// TICKET PRINTER CONTROLLER
// ============================================

export interface TicketData {
  tokenNumber: string
  entryTime: Date
  vehiclePlate?: string
  parkingLotName: string
  qrCodeData: string
  instructions?: string[]
}

export class TicketPrinter {
  private printerId: string
  private address: string
  private protocol: 'USB' | 'NETWORK' | 'SERIAL'

  constructor(printerId: string, address: string, protocol: 'USB' | 'NETWORK' | 'SERIAL' = 'NETWORK') {
    this.printerId = printerId
    this.address = address
    this.protocol = protocol
  }

  async printTicket(ticket: TicketData): Promise<boolean> {
    try {
      const escPosData = this.generateEscPos(ticket)
      return await this.sendToPrinter(escPosData)
    } catch (error) {
      logger.error(`Printer ${this.printerId} error:`, error)
      return false
    }
  }

  private generateEscPos(ticket: TicketData): Buffer {
    // ESC/POS commands for thermal printer
    const commands: number[] = []

    // Initialize printer
    commands.push(0x1B, 0x40) // ESC @

    // Center align
    commands.push(0x1B, 0x61, 0x01) // ESC a 1

    // Bold on
    commands.push(0x1B, 0x45, 0x01) // ESC E 1

    // Add header
    const header = `${ticket.parkingLotName}\n`
    commands.push(...Buffer.from(header))

    // Bold off
    commands.push(0x1B, 0x45, 0x00)

    // Add separator
    commands.push(...Buffer.from('================================\n'))

    // Left align for details
    commands.push(0x1B, 0x61, 0x00)

    // Add ticket details
    const details = [
      `Token: ${ticket.tokenNumber}`,
      `Entry: ${ticket.entryTime.toLocaleString()}`,
      ticket.vehiclePlate ? `Plate: ${ticket.vehiclePlate}` : '',
      '================================'
    ].filter(Boolean).join('\n') + '\n'

    commands.push(...Buffer.from(details))

    // Center for QR code placeholder
    commands.push(0x1B, 0x61, 0x01)
    commands.push(...Buffer.from(`[QR: ${ticket.qrCodeData}]\n`))

    // Add instructions
    if (ticket.instructions?.length) {
      commands.push(...Buffer.from('\n'))
      for (const instruction of ticket.instructions) {
        commands.push(...Buffer.from(`${instruction}\n`))
      }
    }

    // Feed and cut
    commands.push(0x1B, 0x64, 0x03) // Feed 3 lines
    commands.push(0x1D, 0x56, 0x42, 0x00) // Partial cut

    return Buffer.from(commands)
  }

  private async sendToPrinter(data: Buffer): Promise<boolean> {
    switch (this.protocol) {
      case 'NETWORK':
        return this.sendNetworkPrint(data)
      case 'USB':
        logger.debug(`USB print to ${this.address}: ${data.length} bytes`)
        return true
      case 'SERIAL':
        logger.debug(`Serial print to ${this.address}: ${data.length} bytes`)
        return true
      default:
        return false
    }
  }

  private async sendNetworkPrint(data: Buffer): Promise<boolean> {
    try {
      // Send raw data to printer port (usually 9100)
      const [host, port] = this.address.split(':')
      logger.debug(`Network print to ${host}:${port || 9100}: ${data.length} bytes`)
      // In production, use net.Socket to send raw data
      return true
    } catch {
      return false
    }
  }
}

// ============================================
// HARDWARE MANAGER
// ============================================

export class HardwareManager {
  private static instance: HardwareManager | null = null
  private gates: Map<string, GateController> = new Map()
  private displays: Map<string, DisplayController> = new Map()
  private printers: Map<string, TicketPrinter> = new Map()

  static getInstance(): HardwareManager {
    if (!HardwareManager.instance) {
      HardwareManager.instance = new HardwareManager()
    }
    return HardwareManager.instance
  }

  // Gate management methods for API routes
  addGate(id: string, config: { name: string; type: GateProtocol; address?: string; port?: number }): void {
    this.gates.set(id, Object.assign(new GateController(id, config.type, config.address || 'localhost', config.port), {
      id,
      name: config.name,
      type: config.type
    }))
  }

  removeGate(id: string): void {
    this.gates.delete(id)
  }

  listGates(): Array<GateController & { id: string; name: string; type: string }> {
    return Array.from(this.gates.values()) as Array<GateController & { id: string; name: string; type: string }>
  }

  // Display management methods for API routes
  addDisplay(id: string, config: { name: string; type: DisplayProtocol; address?: string; port?: number }): void {
    this.displays.set(id, Object.assign(new DisplayController(id, config.type, config.address || 'localhost', config.port), {
      id,
      name: config.name,
      type: config.type
    }))
  }

  removeDisplay(id: string): void {
    this.displays.delete(id)
  }

  listDisplays(): Array<DisplayController & { id: string; name: string; type: string }> {
    return Array.from(this.displays.values()) as Array<DisplayController & { id: string; name: string; type: string }>
  }

  async initialize(parkingLotId: string): Promise<void> {
    // Load gates
    const gates = await prisma.gate.findMany({
      where: { parkingLotId }
    })

    for (const gate of gates) {
      if (gate.controllerType && gate.controllerAddress) {
        this.gates.set(gate.id, new GateController(
          gate.id,
          gate.controllerType as GateProtocol,
          gate.controllerAddress
        ))
      }
    }

    // Load displays
    const displays = await prisma.display.findMany({
      where: { parkingLotId }
    })

    for (const display of displays) {
      if (display.protocol && display.address) {
        this.displays.set(display.id, new DisplayController(
          display.id,
          display.protocol as DisplayProtocol,
          display.address
        ))
      }
    }

    logger.debug(`Hardware initialized: ${this.gates.size} gates, ${this.displays.size} displays`)
  }

  getGate(gateId: string): GateController | undefined {
    return this.gates.get(gateId)
  }

  getDisplay(displayId: string): DisplayController | undefined {
    return this.displays.get(displayId)
  }

  async openEntryGate(parkingLotId: string): Promise<boolean> {
    const gate = await prisma.gate.findFirst({
      where: { parkingLotId, gateType: 'ENTRY' }
    })

    if (!gate) return false

    const controller = this.gates.get(gate.id)
    return controller?.open() ?? false
  }

  async openExitGate(parkingLotId: string): Promise<boolean> {
    const gate = await prisma.gate.findFirst({
      where: { parkingLotId, gateType: 'EXIT' }
    })

    if (!gate) return false

    const controller = this.gates.get(gate.id)
    return controller?.open() ?? false
  }

  async updateAllDisplays(parkingLotId: string): Promise<void> {
    // Get occupancy data
    const lot = await prisma.parkingLot.findUnique({
      where: { id: parkingLotId },
      include: {
        zones: {
          include: {
            slots: {
              select: { isOccupied: true }
            }
          }
        }
      }
    })

    if (!lot) return

    // Calculate availability
    const zoneInfo = lot.zones.map(zone => ({
      name: zone.name,
      available: zone.slots.filter(s => !s.isOccupied).length
    }))

    const totalSlots = lot.zones.reduce((sum, z) => sum + z.slots.length, 0)
    const availableSlots = zoneInfo.reduce((sum, z) => sum + z.available, 0)

    // Update each display
    for (const [, display] of this.displays) {
      await display.updateMessage({
        line1: lot.name,
        availableSlots,
        totalSlots,
        zoneInfo
      })
    }
  }
}

// Singleton instance
let hardwareManager: HardwareManager | null = null

export function getHardwareManager(): HardwareManager {
  if (!hardwareManager) {
    hardwareManager = new HardwareManager()
  }
  return hardwareManager
}
