/**
 * Offline Sync Queue
 * Handles operations when the system is offline and syncs when back online
 */

import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'

// ============================================
// TYPES
// ============================================

export type SyncOperation =
  | 'CREATE_TOKEN'
  | 'UPDATE_TOKEN'
  | 'COMPLETE_TOKEN'
  | 'CREATE_PAYMENT'
  | 'UPDATE_SLOT'
  | 'GATE_OPERATION'
  | 'DETECTION_EVENT'

export interface QueuedOperation {
  id: string
  operation: SyncOperation
  data: Record<string, unknown>
  timestamp: Date
  retryCount: number
  maxRetries: number
  priority: 'low' | 'normal' | 'high' | 'critical'
  status: 'pending' | 'processing' | 'completed' | 'failed'
  error?: string
  createdAt: Date
  processedAt?: Date
}

export interface SyncStatus {
  isOnline: boolean
  pendingOperations: number
  lastSyncTime: Date | null
  failedOperations: number
}

// ============================================
// OFFLINE QUEUE MANAGER
// ============================================

class OfflineQueueManager {
  private queue: Map<string, QueuedOperation> = new Map()
  private isOnline: boolean = true
  private lastSyncTime: Date | null = null
  private syncInterval: NodeJS.Timeout | null = null
  private listeners: Set<(status: SyncStatus) => void> = new Set()

  constructor() {
    this.startSyncMonitor()
  }

  /**
   * Start monitoring for online status and process queue
   */
  private startSyncMonitor(): void {
    // Check connectivity and process queue every 5 seconds
    this.syncInterval = setInterval(() => {
      this.checkConnectivity()
      if (this.isOnline) {
        this.processQueue()
      }
    }, 5000)
  }

  /**
   * Check database connectivity
   */
  private async checkConnectivity(): Promise<void> {
    try {
      await prisma.$queryRaw`SELECT 1`
      if (!this.isOnline) {
        this.isOnline = true
        this.notifyListeners()
        logger.debug('Connection restored - processing offline queue')
      }
    } catch {
      if (this.isOnline) {
        this.isOnline = false
        this.notifyListeners()
        logger.debug('Connection lost - queuing operations offline')
      }
    }
  }

  /**
   * Add operation to the queue
   */
  enqueue(
    operation: SyncOperation,
    data: Record<string, unknown>,
    options: {
      priority?: 'low' | 'normal' | 'high' | 'critical'
      maxRetries?: number
    } = {}
  ): string {
    const id = crypto.randomUUID()
    const queuedOp: QueuedOperation = {
      id,
      operation,
      data,
      timestamp: new Date(),
      retryCount: 0,
      maxRetries: options.maxRetries || 3,
      priority: options.priority || 'normal',
      status: 'pending',
      createdAt: new Date()
    }

    this.queue.set(id, queuedOp)
    this.notifyListeners()

    // If online, process immediately
    if (this.isOnline) {
      this.processOperation(id)
    }

    return id
  }

  /**
   * Process the entire queue
   */
  private async processQueue(): Promise<void> {
    const pendingOps = Array.from(this.queue.values())
      .filter(op => op.status === 'pending')
      .sort((a, b) => {
        // Sort by priority (critical first) then by timestamp
        const priorityOrder = { critical: 0, high: 1, normal: 2, low: 3 }
        const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority]
        if (priorityDiff !== 0) return priorityDiff
        return a.timestamp.getTime() - b.timestamp.getTime()
      })

    for (const op of pendingOps) {
      await this.processOperation(op.id)
    }
  }

  /**
   * Process a single operation
   */
  private async processOperation(operationId: string): Promise<boolean> {
    const op = this.queue.get(operationId)
    if (!op || op.status !== 'pending') return false

    op.status = 'processing'
    this.queue.set(operationId, op)

    try {
      await this.executeOperation(op)
      op.status = 'completed'
      op.processedAt = new Date()
      this.lastSyncTime = new Date()
      this.queue.set(operationId, op)

      // Remove completed operations after a delay
      setTimeout(() => this.queue.delete(operationId), 60000)

      this.notifyListeners()
      return true
    } catch (error) {
      op.retryCount++
      op.error = error instanceof Error ? error.message : 'Unknown error'

      if (op.retryCount >= op.maxRetries) {
        op.status = 'failed'
        logger.error(`Operation ${operationId} failed after ${op.maxRetries} retries:`, error)
      } else {
        op.status = 'pending'
        logger.warn(`Operation ${operationId} failed, will retry (${op.retryCount}/${op.maxRetries})`)
      }

      this.queue.set(operationId, op)
      this.notifyListeners()
      return false
    }
  }

  /**
   * Execute the actual operation
   */
  private async executeOperation(op: QueuedOperation): Promise<void> {
    switch (op.operation) {
      case 'CREATE_TOKEN':
        await prisma.token.create({
          data: op.data as Parameters<typeof prisma.token.create>[0]['data']
        })
        break

      case 'UPDATE_TOKEN':
        const { id: tokenId, ...tokenData } = op.data as { id: string; [key: string]: unknown }
        await prisma.token.update({
          where: { id: tokenId },
          data: tokenData as Parameters<typeof prisma.token.update>[0]['data']
        })
        break

      case 'COMPLETE_TOKEN':
        await prisma.token.update({
          where: { id: op.data.id as string },
          data: {
            status: 'COMPLETED',
            exitTime: new Date(op.data.exitTime as string)
          }
        })
        break

      case 'CREATE_PAYMENT':
        await prisma.payment.create({
          data: op.data as Parameters<typeof prisma.payment.create>[0]['data']
        })
        break

      case 'UPDATE_SLOT':
        const { id: slotId, ...slotData } = op.data as { id: string; [key: string]: unknown }
        await prisma.slot.update({
          where: { id: slotId },
          data: slotData as Parameters<typeof prisma.slot.update>[0]['data']
        })
        break

      case 'GATE_OPERATION':
        // Gate operations are fire-and-forget, just log
        logger.debug('Synced gate operation:', op.data)
        break

      case 'DETECTION_EVENT':
        // Store detection events
        await prisma.detectionEvent.create({
          data: op.data as Parameters<typeof prisma.detectionEvent.create>[0]['data']
        })
        break

      default:
        throw new Error(`Unknown operation type: ${op.operation}`)
    }
  }

  /**
   * Get current sync status
   */
  getStatus(): SyncStatus {
    const operations = Array.from(this.queue.values())
    return {
      isOnline: this.isOnline,
      pendingOperations: operations.filter(op => op.status === 'pending').length,
      lastSyncTime: this.lastSyncTime,
      failedOperations: operations.filter(op => op.status === 'failed').length
    }
  }

  /**
   * Get all queued operations
   */
  getQueuedOperations(): QueuedOperation[] {
    return Array.from(this.queue.values())
  }

  /**
   * Retry a failed operation
   */
  retryOperation(operationId: string): boolean {
    const op = this.queue.get(operationId)
    if (!op || op.status !== 'failed') return false

    op.status = 'pending'
    op.retryCount = 0
    op.error = undefined
    this.queue.set(operationId, op)

    if (this.isOnline) {
      this.processOperation(operationId)
    }

    return true
  }

  /**
   * Retry all failed operations
   */
  retryAllFailed(): number {
    let count = 0
    for (const op of this.queue.values()) {
      if (op.status === 'failed') {
        this.retryOperation(op.id)
        count++
      }
    }
    return count
  }

  /**
   * Clear completed operations
   */
  clearCompleted(): number {
    let count = 0
    for (const [id, op] of this.queue.entries()) {
      if (op.status === 'completed') {
        this.queue.delete(id)
        count++
      }
    }
    this.notifyListeners()
    return count
  }

  /**
   * Clear failed operations
   */
  clearFailed(): number {
    let count = 0
    for (const [id, op] of this.queue.entries()) {
      if (op.status === 'failed') {
        this.queue.delete(id)
        count++
      }
    }
    this.notifyListeners()
    return count
  }

  /**
   * Subscribe to status changes
   */
  subscribe(callback: (status: SyncStatus) => void): () => void {
    this.listeners.add(callback)
    return () => this.listeners.delete(callback)
  }

  /**
   * Notify all listeners of status change
   */
  private notifyListeners(): void {
    const status = this.getStatus()
    for (const listener of this.listeners) {
      try {
        listener(status)
      } catch (error) {
        logger.error('Error in sync listener:', error)
      }
    }
  }

  /**
   * Force sync now
   */
  async forceSync(): Promise<SyncStatus> {
    await this.checkConnectivity()
    if (this.isOnline) {
      await this.processQueue()
    }
    return this.getStatus()
  }

  /**
   * Cleanup
   */
  destroy(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval)
    }
    this.listeners.clear()
  }
}

// ============================================
// SINGLETON INSTANCE
// ============================================

let instance: OfflineQueueManager | null = null

export function getOfflineQueue(): OfflineQueueManager {
  if (!instance) {
    instance = new OfflineQueueManager()
  }
  return instance
}

// ============================================
// CONVENIENCE FUNCTIONS
// ============================================

/**
 * Enqueue a token creation (for offline entry)
 */
export function queueTokenCreation(data: {
  tokenNumber: string
  licensePlate?: string
  vehicleType?: string
  slotId: string
}): string {
  return getOfflineQueue().enqueue('CREATE_TOKEN', {
    ...data,
    status: 'ACTIVE',
    entryTime: new Date().toISOString()
  }, { priority: 'high' })
}

/**
 * Enqueue a token completion (for offline exit)
 */
export function queueTokenCompletion(tokenId: string): string {
  return getOfflineQueue().enqueue('COMPLETE_TOKEN', {
    id: tokenId,
    exitTime: new Date().toISOString()
  }, { priority: 'high' })
}

/**
 * Enqueue a payment creation
 */
export function queuePaymentCreation(data: {
  tokenId: string
  amount: number
  method: string
}): string {
  return getOfflineQueue().enqueue('CREATE_PAYMENT', {
    ...data,
    status: 'PENDING',
    createdAt: new Date().toISOString()
  }, { priority: 'critical' })
}

/**
 * Enqueue a slot status update
 */
export function queueSlotUpdate(slotId: string, status: 'AVAILABLE' | 'OCCUPIED'): string {
  return getOfflineQueue().enqueue('UPDATE_SLOT', {
    id: slotId,
    status,
    lastUpdated: new Date().toISOString()
  }, { priority: 'normal' })
}

/**
 * Enqueue a detection event
 */
export function queueDetectionEvent(data: {
  cameraId: string
  licensePlate?: string
  vehicleType?: string
  confidence: number
  imageUrl?: string
}): string {
  return getOfflineQueue().enqueue('DETECTION_EVENT', {
    ...data,
    timestamp: new Date().toISOString()
  }, { priority: 'low' })
}

export default OfflineQueueManager
