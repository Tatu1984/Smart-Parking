// Hooks Layer Exports
// Re-export all custom hooks

// Auth
export { useAuth } from './useAuth'

// User
export { useUser, useUsers } from './useUser'

// Parking
export { useParkingLots, useParkingLot, useSlots, useTokens } from './useParking'

// WebSocket / Real-time
export {
  useWebSocket,
  useRealtimeEvent,
  useSlotUpdates,
  useNotifications,
} from './useWebSocket'

// Existing hooks
export { useAnalyticsData } from './use-analytics-data'
export { useDashboardData } from './use-dashboard-data'
export { useIsMobile } from './use-mobile'
export { useSocket } from './use-socket'
