// Payment Service
// Handles payments, wallet, and transaction operations

import { apiClient, API_ENDPOINTS } from '@/lib/api'
import type { Wallet, WalletTransaction, Transaction, PaginatedResponse } from '@/lib/api/types'

// Types for payment operations
export interface DepositRequest {
  amount: number
  currency?: string
  bankAccountId?: string
}

export interface WithdrawRequest {
  amount: number
  bankAccountId: string
}

export interface TransferRequest {
  amount: number
  recipientWalletId: string
  description?: string
}

export interface ParkingPaymentRequest {
  tokenId: string
  paymentMethod: 'WALLET' | 'CASH' | 'CARD' | 'UPI'
  amount: number
}

export interface PaymentRequestData {
  amount: number
  description?: string
  expiresAt?: string
}

export interface BankAccount {
  id: string
  accountHolderName: string
  bankName: string
  accountNumberLast4: string
  ifscCode: string
  accountType: string
  status: string
  isPrimary: boolean
}

export interface TransactionFilters {
  page?: number
  pageSize?: number
  startDate?: string
  endDate?: string
  status?: string
  type?: string
}

export const paymentService = {
  // Wallet
  async getWallet(): Promise<Wallet> {
    return apiClient.get<Wallet>(API_ENDPOINTS.WALLET.GET)
  },

  async getWalletById(id: string): Promise<Wallet> {
    return apiClient.get<Wallet>(API_ENDPOINTS.WALLET.BY_ID(id))
  },

  async getWalletBalance(id: string): Promise<{ balance: number; currency: string }> {
    return apiClient.get(API_ENDPOINTS.WALLET.BALANCE(id))
  },

  async getWalletTransactions(id: string, filters?: TransactionFilters): Promise<PaginatedResponse<WalletTransaction>> {
    return apiClient.get<PaginatedResponse<WalletTransaction>>(API_ENDPOINTS.WALLET.TRANSACTIONS(id), {
      params: filters,
    })
  },

  // Bank Accounts
  async listBankAccounts(): Promise<BankAccount[]> {
    return apiClient.get<BankAccount[]>(API_ENDPOINTS.BANK_ACCOUNTS.LIST)
  },

  async getBankAccountById(id: string): Promise<BankAccount> {
    return apiClient.get<BankAccount>(API_ENDPOINTS.BANK_ACCOUNTS.BY_ID(id))
  },

  async addBankAccount(data: {
    accountHolderName: string
    bankName: string
    accountNumber: string
    ifscCode: string
    accountType?: string
  }): Promise<BankAccount> {
    return apiClient.post<BankAccount>(API_ENDPOINTS.BANK_ACCOUNTS.CREATE, data)
  },

  async verifyBankAccount(id: string, amount: number): Promise<BankAccount> {
    return apiClient.post<BankAccount>(API_ENDPOINTS.BANK_ACCOUNTS.VERIFY(id), { amount })
  },

  async deleteBankAccount(id: string): Promise<void> {
    await apiClient.delete(API_ENDPOINTS.BANK_ACCOUNTS.DELETE(id))
  },

  // Payment Operations
  async deposit(data: DepositRequest): Promise<WalletTransaction> {
    return apiClient.post<WalletTransaction>(API_ENDPOINTS.PAYMENTS.DEPOSIT, data)
  },

  async withdraw(data: WithdrawRequest): Promise<WalletTransaction> {
    return apiClient.post<WalletTransaction>(API_ENDPOINTS.PAYMENTS.WITHDRAW, data)
  },

  async transfer(data: TransferRequest): Promise<WalletTransaction> {
    return apiClient.post<WalletTransaction>(API_ENDPOINTS.PAYMENTS.TRANSFER, data)
  },

  async payForParking(data: ParkingPaymentRequest): Promise<Transaction> {
    return apiClient.post<Transaction>(API_ENDPOINTS.PAYMENTS.PARKING, data)
  },

  async verifyPayment(paymentRef: string): Promise<{ verified: boolean; transaction?: Transaction }> {
    return apiClient.post(API_ENDPOINTS.PAYMENTS.VERIFY, { paymentRef })
  },

  // Payment Requests (QR/Link payments)
  async createPaymentRequest(data: PaymentRequestData): Promise<{ id: string; qrCode: string; link: string }> {
    return apiClient.post(API_ENDPOINTS.PAYMENTS.REQUEST, data)
  },

  async getPaymentRequest(id: string): Promise<{ id: string; amount: number; status: string; qrCode: string }> {
    return apiClient.get(API_ENDPOINTS.PAYMENTS.REQUEST_BY_ID(id))
  },

  async payPaymentRequest(id: string): Promise<WalletTransaction> {
    return apiClient.post<WalletTransaction>(API_ENDPOINTS.PAYMENTS.REQUEST_PAY(id))
  },

  // Parking Transactions
  async listTransactions(filters?: TransactionFilters): Promise<PaginatedResponse<Transaction>> {
    return apiClient.get<PaginatedResponse<Transaction>>(API_ENDPOINTS.TRANSACTIONS.LIST, {
      params: filters,
    })
  },
}
