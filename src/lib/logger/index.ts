/**
 * Structured Logging Utility
 * Provides consistent logging with correlation IDs and context
 */

import { randomUUID } from 'crypto'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogContext {
  correlationId?: string
  userId?: string
  requestId?: string
  path?: string
  method?: string
  duration?: number
  statusCode?: number
  [key: string]: unknown
}

interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  context?: LogContext
  error?: {
    name: string
    message: string
    stack?: string
  }
}

class Logger {
  private static instance: Logger
  private minLevel: LogLevel = 'info'

  private levelPriority: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  }

  private constructor() {
    const envLevel = process.env.LOG_LEVEL as LogLevel | undefined
    if (envLevel && this.levelPriority[envLevel] !== undefined) {
      this.minLevel = envLevel
    }

    // More verbose in development
    if (process.env.NODE_ENV === 'development') {
      this.minLevel = 'debug'
    }
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger()
    }
    return Logger.instance
  }

  private shouldLog(level: LogLevel): boolean {
    return this.levelPriority[level] >= this.levelPriority[this.minLevel]
  }

  private formatEntry(entry: LogEntry): string {
    if (process.env.NODE_ENV === 'development') {
      // Pretty format for development
      const color = {
        debug: '\x1b[36m', // cyan
        info: '\x1b[32m', // green
        warn: '\x1b[33m', // yellow
        error: '\x1b[31m', // red
      }[entry.level]
      const reset = '\x1b[0m'

      let output = `${color}[${entry.level.toUpperCase()}]${reset} ${entry.message}`

      if (entry.context?.correlationId) {
        output += ` ${'\x1b[90m'}[${entry.context.correlationId}]${reset}`
      }

      if (entry.error) {
        output += `\n  Error: ${entry.error.message}`
        if (entry.error.stack) {
          output += `\n  ${entry.error.stack}`
        }
      }

      return output
    }

    // JSON format for production
    return JSON.stringify(entry)
  }

  private log(level: LogLevel, message: string, context?: LogContext, error?: Error): void {
    if (!this.shouldLog(level)) return

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
    }

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      }
    }

    const formatted = this.formatEntry(entry)

    switch (level) {
      case 'debug':
      case 'info':
        console.log(formatted)
        break
      case 'warn':
        console.warn(formatted)
        break
      case 'error':
        console.error(formatted)
        break
    }
  }

  debug(message: string, context?: LogContext): void {
    this.log('debug', message, context)
  }

  info(message: string, context?: LogContext): void {
    this.log('info', message, context)
  }

  warn(message: string, context?: LogContext): void {
    this.log('warn', message, context)
  }

  error(message: string, error?: Error, context?: LogContext): void {
    this.log('error', message, context, error)
  }

  // Log HTTP request
  request(method: string, path: string, context?: LogContext): void {
    this.info(`${method} ${path}`, { ...context, method, path })
  }

  // Log HTTP response
  response(method: string, path: string, statusCode: number, duration: number, context?: LogContext): void {
    const level: LogLevel = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info'
    this.log(level, `${method} ${path} ${statusCode} ${duration}ms`, {
      ...context,
      method,
      path,
      statusCode,
      duration,
    })
  }

  // Log database query (use sparingly)
  query(operation: string, table: string, duration: number, context?: LogContext): void {
    this.debug(`DB ${operation} on ${table} (${duration}ms)`, context)
  }
}

// Singleton export
export const logger = Logger.getInstance()

// Correlation ID management
export function generateCorrelationId(): string {
  return randomUUID()
}

// Create a context object with correlation ID
export function createLogContext(correlationId?: string): LogContext {
  return {
    correlationId: correlationId || generateCorrelationId(),
  }
}

// HTTP request logger middleware helper
export function logRequest(
  method: string,
  path: string,
  userId?: string
): LogContext {
  const context = createLogContext()
  context.userId = userId
  logger.request(method, path, context)
  return context
}

// HTTP response logger helper
export function logResponse(
  method: string,
  path: string,
  statusCode: number,
  startTime: number,
  context: LogContext
): void {
  const duration = Date.now() - startTime
  logger.response(method, path, statusCode, duration, context)
}

// Sanitize sensitive data from logs
export function sanitizeForLog(obj: Record<string, unknown>): Record<string, unknown> {
  const sensitiveKeys = ['password', 'token', 'secret', 'authorization', 'cookie', 'creditCard']
  const sanitized = { ...obj }

  for (const key of Object.keys(sanitized)) {
    const lowerKey = key.toLowerCase()
    if (sensitiveKeys.some((sk) => lowerKey.includes(sk))) {
      sanitized[key] = '[REDACTED]'
    } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      sanitized[key] = sanitizeForLog(sanitized[key] as Record<string, unknown>)
    }
  }

  return sanitized
}

export type { LogContext }
