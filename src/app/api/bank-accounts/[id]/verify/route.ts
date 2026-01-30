import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { getCurrentUser } from '@/lib/auth/session'
import { logger } from '@/lib/logger'

// POST /api/bank-accounts/[id]/verify - Verify penny drop amount
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { amount } = body // Amount in paise that was deposited

    // Verify ownership
    const bankAccount = await prisma.bankAccount.findFirst({
      where: { id },
      include: {
        wallet: {
          select: { id: true, userId: true },
        },
      },
    })

    if (!bankAccount || bankAccount.wallet.userId !== user.id) {
      return NextResponse.json({ success: false, error: 'Bank account not found' }, { status: 404 })
    }

    if (bankAccount.status === 'VERIFIED') {
      return NextResponse.json(
        { success: false, error: 'Bank account already verified' },
        { status: 400 }
      )
    }

    if (bankAccount.isSandbox) {
      // Sandbox accounts are auto-verified
      return NextResponse.json(
        { success: false, error: 'Sandbox accounts are auto-verified' },
        { status: 400 }
      )
    }

    // Verify the penny drop amount matches what was stored during initiation
    // If no amount was stored, this is an error in the verification flow
    const expectedAmount = bankAccount.pennyDropAmount

    if (!expectedAmount) {
      return NextResponse.json(
        { success: false, error: 'Verification not initiated properly. Please re-add the bank account.' },
        { status: 400 }
      )
    }

    if (amount !== expectedAmount) {
      // Track failed attempts
      const currentAttempts = bankAccount.verificationAttempts || 0

      // Increment verification attempts
      await prisma.bankAccount.update({
        where: { id },
        data: {
          verificationAttempts: currentAttempts + 1,
        },
      })

      if (currentAttempts >= 2) {
        // Max 3 attempts, mark as failed
        await prisma.bankAccount.update({
          where: { id },
          data: {
            status: 'FAILED',
            pennyDropStatus: 'FAILED',
          },
        })

        return NextResponse.json(
          { success: false, error: 'Maximum verification attempts exceeded. Please add a new bank account.' },
          { status: 400 }
        )
      }

      return NextResponse.json(
        {
          success: false,
          error: 'Incorrect amount. Please check the deposit amount and try again.',
          attemptsRemaining: 2 - currentAttempts,
        },
        { status: 400 }
      )
    }

    // Verification successful
    const updatedAccount = await prisma.bankAccount.update({
      where: { id },
      data: {
        status: 'VERIFIED',
        pennyDropStatus: 'SUCCESS',
        verifiedAt: new Date(),
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        ...updatedAccount,
        sandboxBalance: null,
      },
      message: 'Bank account verified successfully',
    })
  } catch (error) {
    logger.error('Error verifying bank account:', error instanceof Error ? error : undefined)
    return NextResponse.json(
      { success: false, error: 'Failed to verify bank account' },
      { status: 500 }
    )
  }
}
