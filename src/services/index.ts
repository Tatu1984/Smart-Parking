// Services Layer Exports
// Re-export all service modules

export { authService } from './auth.service'
export { userService } from './user.service'
export type { UpdateProfileData, CreateUserData, UserFilters } from './user.service'

export { parkingService } from './parking.service'
export type {
  ParkingLotFilters,
  ZoneFilters,
  SlotFilters,
  TokenFilters,
  ParkingLotStatus,
} from './parking.service'

export { paymentService } from './payment.service'
export type {
  DepositRequest,
  WithdrawRequest,
  TransferRequest,
  ParkingPaymentRequest,
  PaymentRequestData,
  BankAccount,
  TransactionFilters,
} from './payment.service'

export { analyticsService } from './analytics.service'
export type {
  AnalyticsFilters,
  DashboardData,
  PredictiveAnalytics,
  ReportRequest,
  Report,
} from './analytics.service'

export { cameraService } from './camera.service'
export type {
  CameraFilters,
  CreateCameraData,
  GateFilters,
  Gate,
  Display,
} from './camera.service'
