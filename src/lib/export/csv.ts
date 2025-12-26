export interface CsvColumn<T> {
  key: keyof T | string
  header: string
  formatter?: (value: unknown, row: T) => string
}

export function generateCsv<T extends Record<string, unknown>>(
  data: T[],
  columns: CsvColumn<T>[]
): string {
  // Header row
  const headerRow = columns.map((col) => escapeCell(col.header)).join(',')

  // Data rows
  const dataRows = data.map((row) => {
    return columns
      .map((col) => {
        const value = getNestedValue(row, col.key as string)
        const formatted = col.formatter ? col.formatter(value, row) : formatValue(value)
        return escapeCell(formatted)
      })
      .join(',')
  })

  return [headerRow, ...dataRows].join('\n')
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce((acc: unknown, key: string) => {
    if (acc && typeof acc === 'object' && key in acc) {
      return (acc as Record<string, unknown>)[key]
    }
    return undefined
  }, obj)
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return ''
  }
  if (value instanceof Date) {
    return value.toISOString()
  }
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No'
  }
  if (typeof value === 'object') {
    return JSON.stringify(value)
  }
  return String(value)
}

function escapeCell(value: string): string {
  // Escape quotes and wrap in quotes if necessary
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

// Common export column definitions
export const transactionColumns: CsvColumn<Record<string, unknown>>[] = [
  { key: 'tokenNumber', header: 'Token Number' },
  { key: 'vehicleNumber', header: 'Vehicle Number' },
  { key: 'vehicleType', header: 'Vehicle Type' },
  {
    key: 'entryTime',
    header: 'Entry Time',
    formatter: (v) => (v ? new Date(v as string).toLocaleString() : ''),
  },
  {
    key: 'exitTime',
    header: 'Exit Time',
    formatter: (v) => (v ? new Date(v as string).toLocaleString() : ''),
  },
  { key: 'duration', header: 'Duration (minutes)' },
  {
    key: 'grossAmount',
    header: 'Amount',
    formatter: (v) => (typeof v === 'number' ? (v / 100).toFixed(2) : ''),
  },
  { key: 'paymentMethod', header: 'Payment Method' },
  { key: 'paymentStatus', header: 'Status' },
]

export const walletTransactionColumns: CsvColumn<Record<string, unknown>>[] = [
  { key: 'referenceId', header: 'Reference ID' },
  { key: 'txnType', header: 'Type' },
  {
    key: 'amount',
    header: 'Amount',
    formatter: (v) => (typeof v === 'number' ? (v / 100).toFixed(2) : ''),
  },
  { key: 'currency', header: 'Currency' },
  { key: 'status', header: 'Status' },
  { key: 'description', header: 'Description' },
  {
    key: 'createdAt',
    header: 'Date',
    formatter: (v) => (v ? new Date(v as string).toLocaleString() : ''),
  },
]
