/**
 * PDF Report Export
 * Generates PDF reports for transactions, occupancy, and analytics
 */

// Using jsPDF for PDF generation
import { jsPDF } from 'jspdf'
import 'jspdf-autotable'

// Extend jsPDF type for autotable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: AutoTableOptions) => jsPDF
    lastAutoTable: { finalY: number }
  }
}

interface AutoTableOptions {
  head?: string[][]
  body?: (string | number)[][]
  startY?: number
  theme?: 'striped' | 'grid' | 'plain'
  styles?: Record<string, unknown>
  headStyles?: Record<string, unknown>
  columnStyles?: Record<string, unknown>
  margin?: { top?: number; right?: number; bottom?: number; left?: number }
}

export type ReportType = 'transactions' | 'occupancy' | 'revenue' | 'vehicles' | 'summary'

export interface ReportConfig {
  type: ReportType
  title: string
  parkingLotName: string
  dateRange: {
    start: Date
    end: Date
  }
  generatedAt: Date
  generatedBy?: string
}

export interface TransactionReportData {
  transactions: {
    id: string
    tokenNumber: string
    entryTime: Date
    exitTime?: Date
    duration: number
    amount: number
    paymentMethod: string
    vehiclePlate?: string
  }[]
  summary: {
    totalTransactions: number
    totalRevenue: number
    averageDuration: number
    averageAmount: number
  }
}

export interface OccupancyReportData {
  hourlyData: {
    hour: number
    avgOccupancy: number
    peakOccupancy: number
    entries: number
    exits: number
  }[]
  zoneData: {
    zoneName: string
    totalSlots: number
    avgOccupancy: number
    peakOccupancy: number
  }[]
  summary: {
    avgOccupancyRate: number
    peakOccupancyRate: number
    totalEntries: number
    totalExits: number
  }
}

export interface RevenueReportData {
  dailyData: {
    date: string
    revenue: number
    transactions: number
    avgTicket: number
  }[]
  paymentMethodBreakdown: {
    method: string
    count: number
    amount: number
  }[]
  summary: {
    totalRevenue: number
    totalTransactions: number
    avgDailyRevenue: number
    topPaymentMethod: string
  }
}

export interface VehiclesReportData {
  vehicleTypeBreakdown: {
    type: string
    count: number
  }[]
  avgDurationByType: {
    type: string
    avgDuration: number
  }[]
  summary: {
    totalVehicles: number
    uniqueVehicles: number
    repeatVisitors: number
    vipVehicles: number
    blacklistedDetected: number
  }
}

export interface SummaryReportData {
  parkingLotInfo: {
    name: string
    totalSlots: number
    zones: number
    cameras: number
    gates: number
  }
  operationalSummary: {
    totalTokens: number
    completedTransactions: number
    totalRevenue: number
    avgParkingDuration: number
  }
  occupancySummary: {
    currentOccupied: number
    currentAvailable: number
    underMaintenance: number
    avgOccupancyRate: number
    peakOccupancyRate: number
  }
  zoneSummary: {
    name: string
    totalSlots: number
    occupiedSlots: number
    availableSlots: number
  }[]
}

/**
 * Generate PDF report
 */
export function generatePDFReport(
  config: ReportConfig,
  data: TransactionReportData | OccupancyReportData | RevenueReportData | VehiclesReportData | SummaryReportData
): Uint8Array {
  const doc = new jsPDF()

  // Add header
  addHeader(doc, config)

  // Add content based on report type
  switch (config.type) {
    case 'transactions':
      addTransactionReport(doc, data as TransactionReportData)
      break
    case 'occupancy':
      addOccupancyReport(doc, data as OccupancyReportData)
      break
    case 'revenue':
      addRevenueReport(doc, data as RevenueReportData)
      break
    case 'vehicles':
      addVehiclesReport(doc, data as VehiclesReportData)
      break
    case 'summary':
      addSummaryReport(doc, data as SummaryReportData)
      break
  }

  // Add footer
  addFooter(doc, config)

  // Return as Uint8Array
  return doc.output('arraybuffer') as unknown as Uint8Array
}

function addHeader(doc: jsPDF, config: ReportConfig): void {
  const pageWidth = doc.internal.pageSize.getWidth()

  // Title
  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.text(config.title, pageWidth / 2, 20, { align: 'center' })

  // Parking lot name
  doc.setFontSize(14)
  doc.setFont('helvetica', 'normal')
  doc.text(config.parkingLotName, pageWidth / 2, 30, { align: 'center' })

  // Date range
  doc.setFontSize(10)
  const dateRange = `${formatDate(config.dateRange.start)} - ${formatDate(config.dateRange.end)}`
  doc.text(dateRange, pageWidth / 2, 38, { align: 'center' })

  // Divider line
  doc.setLineWidth(0.5)
  doc.line(20, 45, pageWidth - 20, 45)
}

function addFooter(doc: jsPDF, config: ReportConfig): void {
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const pageCount = doc.getNumberOfPages()

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')

    // Generated timestamp
    doc.text(
      `Generated: ${formatDateTime(config.generatedAt)}${config.generatedBy ? ` by ${config.generatedBy}` : ''}`,
      20,
      pageHeight - 10
    )

    // Page number
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - 30, pageHeight - 10)
  }
}

function addTransactionReport(doc: jsPDF, data: TransactionReportData): void {
  let yPos = 55

  // Summary section
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('Summary', 20, yPos)
  yPos += 8

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  const summaryLines = [
    `Total Transactions: ${data.summary.totalTransactions}`,
    `Total Revenue: ${formatCurrency(data.summary.totalRevenue)}`,
    `Average Duration: ${formatDuration(data.summary.averageDuration)}`,
    `Average Amount: ${formatCurrency(data.summary.averageAmount)}`
  ]

  for (const line of summaryLines) {
    doc.text(line, 25, yPos)
    yPos += 6
  }

  yPos += 10

  // Transactions table
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('Transaction Details', 20, yPos)

  const tableHead = [['Token', 'Entry Time', 'Exit Time', 'Duration', 'Amount', 'Method', 'Plate']]
  const tableBody = data.transactions.map(t => [
    t.tokenNumber,
    formatDateTime(t.entryTime),
    t.exitTime ? formatDateTime(t.exitTime) : '-',
    formatDuration(t.duration),
    formatCurrency(t.amount),
    t.paymentMethod,
    t.vehiclePlate || '-'
  ])

  doc.autoTable({
    head: tableHead,
    body: tableBody,
    startY: yPos + 5,
    theme: 'striped',
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [30, 58, 95] },
    columnStyles: {
      0: { cellWidth: 25 },
      1: { cellWidth: 30 },
      2: { cellWidth: 30 },
      3: { cellWidth: 20 },
      4: { cellWidth: 25 },
      5: { cellWidth: 20 },
      6: { cellWidth: 25 }
    }
  })
}

function addOccupancyReport(doc: jsPDF, data: OccupancyReportData): void {
  let yPos = 55

  // Summary section
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('Summary', 20, yPos)
  yPos += 8

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  const summaryLines = [
    `Average Occupancy: ${(data.summary.avgOccupancyRate * 100).toFixed(1)}%`,
    `Peak Occupancy: ${(data.summary.peakOccupancyRate * 100).toFixed(1)}%`,
    `Total Entries: ${data.summary.totalEntries}`,
    `Total Exits: ${data.summary.totalExits}`
  ]

  for (const line of summaryLines) {
    doc.text(line, 25, yPos)
    yPos += 6
  }

  yPos += 10

  // Zone breakdown table
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('Zone Breakdown', 20, yPos)

  const zoneHead = [['Zone', 'Total Slots', 'Avg Occupancy', 'Peak Occupancy']]
  const zoneBody = data.zoneData.map(z => [
    z.zoneName,
    z.totalSlots.toString(),
    `${(z.avgOccupancy * 100).toFixed(1)}%`,
    `${(z.peakOccupancy * 100).toFixed(1)}%`
  ])

  doc.autoTable({
    head: zoneHead,
    body: zoneBody,
    startY: yPos + 5,
    theme: 'striped',
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [30, 58, 95] }
  })

  yPos = doc.lastAutoTable.finalY + 15

  // Hourly breakdown table
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('Hourly Breakdown', 20, yPos)

  const hourlyHead = [['Hour', 'Avg Occupancy', 'Peak Occupancy', 'Entries', 'Exits']]
  const hourlyBody = data.hourlyData.map(h => [
    `${h.hour.toString().padStart(2, '0')}:00`,
    `${(h.avgOccupancy * 100).toFixed(1)}%`,
    `${(h.peakOccupancy * 100).toFixed(1)}%`,
    h.entries.toString(),
    h.exits.toString()
  ])

  doc.autoTable({
    head: hourlyHead,
    body: hourlyBody,
    startY: yPos + 5,
    theme: 'striped',
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [30, 58, 95] }
  })
}

function addRevenueReport(doc: jsPDF, data: RevenueReportData): void {
  let yPos = 55

  // Summary section
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('Summary', 20, yPos)
  yPos += 8

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  const summaryLines = [
    `Total Revenue: ${formatCurrency(data.summary.totalRevenue)}`,
    `Total Transactions: ${data.summary.totalTransactions}`,
    `Average Daily Revenue: ${formatCurrency(data.summary.avgDailyRevenue)}`,
    `Top Payment Method: ${data.summary.topPaymentMethod}`
  ]

  for (const line of summaryLines) {
    doc.text(line, 25, yPos)
    yPos += 6
  }

  yPos += 10

  // Payment method breakdown
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('Payment Method Breakdown', 20, yPos)

  const paymentHead = [['Method', 'Transactions', 'Amount', 'Percentage']]
  const totalAmount = data.paymentMethodBreakdown.reduce((sum, p) => sum + p.amount, 0)
  const paymentBody = data.paymentMethodBreakdown.map(p => [
    p.method,
    p.count.toString(),
    formatCurrency(p.amount),
    `${((p.amount / totalAmount) * 100).toFixed(1)}%`
  ])

  doc.autoTable({
    head: paymentHead,
    body: paymentBody,
    startY: yPos + 5,
    theme: 'striped',
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [30, 58, 95] }
  })

  yPos = doc.lastAutoTable.finalY + 15

  // Daily revenue table
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('Daily Revenue', 20, yPos)

  const dailyHead = [['Date', 'Revenue', 'Transactions', 'Avg Ticket']]
  const dailyBody = data.dailyData.map(d => [
    d.date,
    formatCurrency(d.revenue),
    d.transactions.toString(),
    formatCurrency(d.avgTicket)
  ])

  doc.autoTable({
    head: dailyHead,
    body: dailyBody,
    startY: yPos + 5,
    theme: 'striped',
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [30, 58, 95] }
  })
}

function addVehiclesReport(doc: jsPDF, data: VehiclesReportData): void {
  let yPos = 55

  // Summary section
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('Summary', 20, yPos)
  yPos += 8

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  const summaryLines = [
    `Total Vehicles: ${data.summary.totalVehicles}`,
    `Unique Vehicles: ${data.summary.uniqueVehicles}`,
    `Repeat Visitors: ${data.summary.repeatVisitors}`,
    `VIP Vehicles: ${data.summary.vipVehicles}`,
    `Blacklisted Detected: ${data.summary.blacklistedDetected}`
  ]

  for (const line of summaryLines) {
    doc.text(line, 25, yPos)
    yPos += 6
  }

  yPos += 10

  // Vehicle type breakdown
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('Vehicle Type Breakdown', 20, yPos)

  const vehicleHead = [['Type', 'Count', 'Percentage']]
  const totalVehicles = data.vehicleTypeBreakdown.reduce((sum, v) => sum + v.count, 0)
  const vehicleBody = data.vehicleTypeBreakdown.map(v => [
    v.type,
    v.count.toString(),
    `${((v.count / totalVehicles) * 100).toFixed(1)}%`
  ])

  doc.autoTable({
    head: vehicleHead,
    body: vehicleBody,
    startY: yPos + 5,
    theme: 'striped',
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [30, 58, 95] }
  })

  yPos = doc.lastAutoTable.finalY + 15

  // Duration by type
  if (data.avgDurationByType.length > 0) {
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('Average Duration by Vehicle Type', 20, yPos)

    const durationHead = [['Type', 'Average Duration']]
    const durationBody = data.avgDurationByType.map(d => [
      d.type,
      formatDuration(d.avgDuration)
    ])

    doc.autoTable({
      head: durationHead,
      body: durationBody,
      startY: yPos + 5,
      theme: 'striped',
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [30, 58, 95] }
    })
  }
}

function addSummaryReport(doc: jsPDF, data: SummaryReportData): void {
  let yPos = 55

  // Parking Lot Info
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('Parking Lot Information', 20, yPos)
  yPos += 8

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  const lotInfoLines = [
    `Name: ${data.parkingLotInfo.name}`,
    `Total Slots: ${data.parkingLotInfo.totalSlots}`,
    `Zones: ${data.parkingLotInfo.zones}`,
    `Cameras: ${data.parkingLotInfo.cameras}`,
    `Gates: ${data.parkingLotInfo.gates}`
  ]

  for (const line of lotInfoLines) {
    doc.text(line, 25, yPos)
    yPos += 6
  }

  yPos += 10

  // Operational Summary
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('Operational Summary', 20, yPos)
  yPos += 8

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  const opLines = [
    `Total Tokens Issued: ${data.operationalSummary.totalTokens}`,
    `Completed Transactions: ${data.operationalSummary.completedTransactions}`,
    `Total Revenue: ${formatCurrency(data.operationalSummary.totalRevenue * 100)}`,
    `Average Parking Duration: ${formatDuration(data.operationalSummary.avgParkingDuration)}`
  ]

  for (const line of opLines) {
    doc.text(line, 25, yPos)
    yPos += 6
  }

  yPos += 10

  // Occupancy Summary
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('Occupancy Summary', 20, yPos)
  yPos += 8

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  const occLines = [
    `Currently Occupied: ${data.occupancySummary.currentOccupied}`,
    `Currently Available: ${data.occupancySummary.currentAvailable}`,
    `Under Maintenance: ${data.occupancySummary.underMaintenance}`,
    `Average Occupancy Rate: ${(data.occupancySummary.avgOccupancyRate * 100).toFixed(1)}%`,
    `Peak Occupancy Rate: ${(data.occupancySummary.peakOccupancyRate * 100).toFixed(1)}%`
  ]

  for (const line of occLines) {
    doc.text(line, 25, yPos)
    yPos += 6
  }

  yPos += 10

  // Zone Summary Table
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('Zone Summary', 20, yPos)

  const zoneHead = [['Zone', 'Total Slots', 'Occupied', 'Available']]
  const zoneBody = data.zoneSummary.map(z => [
    z.name,
    z.totalSlots.toString(),
    z.occupiedSlots.toString(),
    z.availableSlots.toString()
  ])

  doc.autoTable({
    head: zoneHead,
    body: zoneBody,
    startY: yPos + 5,
    theme: 'striped',
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [30, 58, 95] }
  })
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  })
}

function formatDateTime(date: Date): string {
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function formatCurrency(amount: number): string {
  // Amount is in paisa, convert to rupees
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0
  }).format(amount / 100)
}

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60

  if (hours > 0) {
    return `${hours}h ${mins}m`
  }
  return `${mins}m`
}

/**
 * Generate and download PDF report (browser-side)
 */
export function downloadPDFReport(
  config: ReportConfig,
  data: TransactionReportData | OccupancyReportData | RevenueReportData,
  filename?: string
): void {
  const pdfData = generatePDFReport(config, data)

  const blob = new Blob([new Uint8Array(pdfData)], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = filename || `${config.type}-report-${formatDate(new Date())}.pdf`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
