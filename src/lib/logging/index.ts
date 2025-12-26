type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  context?: string
  data?: Record<string, unknown>
  error?: {
    name: string
    message: string
    stack?: string
  }
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

const currentLevel = (process.env.LOG_LEVEL as LogLevel) || 'info'
const isProduction = process.env.NODE_ENV === 'production'

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel]
}

function formatLog(entry: LogEntry): string {
  if (isProduction) {
    return JSON.stringify(entry)
  }

  const { timestamp, level, message, context, data, error } = entry
  const prefix = context ? `[${context}]` : ''
  const dataStr = data ? ` ${JSON.stringify(data)}` : ''
  const errorStr = error ? ` Error: ${error.message}` : ''

  return `${timestamp} ${level.toUpperCase()} ${prefix} ${message}${dataStr}${errorStr}`
}

function createLogEntry(
  level: LogLevel,
  message: string,
  context?: string,
  data?: Record<string, unknown>,
  error?: Error
): LogEntry {
  return {
    timestamp: new Date().toISOString(),
    level,
    message,
    context,
    data,
    error: error ? {
      name: error.name,
      message: error.message,
      stack: isProduction ? undefined : error.stack,
    } : undefined,
  }
}

export const logger = {
  debug(message: string, context?: string, data?: Record<string, unknown>) {
    if (shouldLog('debug')) {
      console.debug(formatLog(createLogEntry('debug', message, context, data)))
    }
  },

  info(message: string, context?: string, data?: Record<string, unknown>) {
    if (shouldLog('info')) {
      console.info(formatLog(createLogEntry('info', message, context, data)))
    }
  },

  warn(message: string, context?: string, data?: Record<string, unknown>) {
    if (shouldLog('warn')) {
      console.warn(formatLog(createLogEntry('warn', message, context, data)))
    }
  },

  error(message: string, error?: Error | unknown, context?: string, data?: Record<string, unknown>) {
    if (shouldLog('error')) {
      const err = error instanceof Error ? error : undefined
      console.error(formatLog(createLogEntry('error', message, context, data, err)))
    }
  },

  child(context: string) {
    return {
      debug: (message: string, data?: Record<string, unknown>) =>
        logger.debug(message, context, data),
      info: (message: string, data?: Record<string, unknown>) =>
        logger.info(message, context, data),
      warn: (message: string, data?: Record<string, unknown>) =>
        logger.warn(message, context, data),
      error: (message: string, error?: Error | unknown, data?: Record<string, unknown>) =>
        logger.error(message, error, context, data),
    }
  },
}

export function logApiRequest(
  method: string,
  path: string,
  userId?: string,
  duration?: number
) {
  logger.info(`${method} ${path}`, 'API', {
    userId,
    duration: duration ? `${duration}ms` : undefined,
  })
}

export function trackError(
  error: Error | unknown,
  context: string,
  metadata?: Record<string, unknown>
) {
  logger.error(
    error instanceof Error ? error.message : 'Unknown error',
    error,
    context,
    metadata
  )
}
