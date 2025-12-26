import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { getCurrentUser } from '@/lib/auth/session'
import { generateCsv, transactionColumns, walletTransactionColumns } from '@/lib/export/csv'

// GET /api/reports/export - Export data as CSV
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const type = searchParams.get('type') || 'transactions'
    const parkingLotId = searchParams.get('parkingLotId')
    const walletId = searchParams.get('walletId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const format = searchParams.get('format') || 'csv'

    let data: Record<string, unknown>[] = []
    let columns = transactionColumns
    let filename = 'export'

    // Date filter
    const dateFilter: Record<string, Date> = {}
    if (startDate) dateFilter.gte = new Date(startDate)
    if (endDate) dateFilter.lte = new Date(endDate)

    if (type === 'transactions' || type === 'parking') {
      // Export parking transactions
      if (!parkingLotId) {
        return NextResponse.json(
          { success: false, error: 'parkingLotId is required for transaction export' },
          { status: 400 }
        )
      }

      const transactions = await prisma.transaction.findMany({
        where: {
          parkingLotId,
          ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter }),
        },
        include: {
          token: {
            select: {
              tokenNumber: true,
              licensePlate: true,
              vehicleType: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 10000, // Limit to prevent memory issues
      })

      data = transactions.map((t) => ({
        tokenNumber: t.token?.tokenNumber || '',
        vehicleNumber: t.token?.licensePlate || '',
        vehicleType: t.token?.vehicleType || '',
        entryTime: t.entryTime.toISOString(),
        exitTime: t.exitTime?.toISOString() || '',
        duration: t.duration || 0,
        grossAmount: Number(t.grossAmount) || 0,
        paymentMethod: t.paymentMethod || '',
        paymentStatus: t.paymentStatus || '',
      }))

      columns = transactionColumns
      filename = `parking_transactions_${new Date().toISOString().split('T')[0]}`
    } else if (type === 'wallet') {
      // Export wallet transactions
      if (!walletId) {
        return NextResponse.json(
          { success: false, error: 'walletId is required for wallet export' },
          { status: 400 }
        )
      }

      // Verify wallet ownership
      const wallet = await prisma.wallet.findFirst({
        where: { id: walletId, userId: user.id },
      })

      if (!wallet) {
        return NextResponse.json({ success: false, error: 'Wallet not found' }, { status: 404 })
      }

      const transactions = await prisma.walletTransaction.findMany({
        where: {
          OR: [{ senderWalletId: walletId }, { receiverWalletId: walletId }],
          ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter }),
        },
        orderBy: { createdAt: 'desc' },
        take: 10000,
      })

      data = transactions.map((t) => ({
        referenceId: t.referenceId,
        txnType: t.txnType,
        amount: Number(t.amount),
        currency: t.currency,
        status: t.status,
        description: t.description || '',
        createdAt: t.createdAt.toISOString(),
      }))

      columns = walletTransactionColumns
      filename = `wallet_transactions_${new Date().toISOString().split('T')[0]}`
    } else if (type === 'daily-summary') {
      // Daily summary export
      if (!parkingLotId) {
        return NextResponse.json(
          { success: false, error: 'parkingLotId is required for summary export' },
          { status: 400 }
        )
      }

      // Aggregate by date
      const transactions = await prisma.transaction.groupBy({
        by: ['paymentMethod', 'paymentStatus'],
        where: {
          parkingLotId,
          ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter }),
        },
        _count: { id: true },
        _sum: { grossAmount: true, netAmount: true },
      })

      data = transactions.map((t) => ({
        paymentMethod: t.paymentMethod || 'Unknown',
        status: t.paymentStatus || 'Unknown',
        count: t._count.id,
        grossAmount: Number(t._sum.grossAmount || 0),
        netAmount: Number(t._sum.netAmount || 0),
      }))

      columns = [
        { key: 'paymentMethod', header: 'Payment Method' },
        { key: 'status', header: 'Status' },
        { key: 'count', header: 'Transaction Count' },
        {
          key: 'grossAmount',
          header: 'Gross Amount',
          formatter: (v) => (typeof v === 'number' ? (v / 100).toFixed(2) : ''),
        },
        {
          key: 'netAmount',
          header: 'Net Amount',
          formatter: (v) => (typeof v === 'number' ? (v / 100).toFixed(2) : ''),
        },
      ]
      filename = `daily_summary_${new Date().toISOString().split('T')[0]}`
    } else {
      return NextResponse.json(
        { success: false, error: 'Invalid export type' },
        { status: 400 }
      )
    }

    if (format === 'json') {
      return NextResponse.json({
        success: true,
        data,
        count: data.length,
      })
    }

    // Generate CSV
    const csv = generateCsv(data, columns)

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}.csv"`,
      },
    })
  } catch (error) {
    console.error('Error exporting data:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to export data' },
      { status: 500 }
    )
  }
}
