'use client'

// Store Providers
// Wrapper component for Zustand stores (if needed for hydration)

import { ReactNode, useEffect, useState } from 'react'

interface StoreProvidersProps {
  children: ReactNode
}

/**
 * StoreProviders component handles hydration of Zustand persisted stores
 * This prevents hydration mismatches when using Zustand with Next.js
 */
export function StoreProviders({ children }: StoreProvidersProps) {
  const [isHydrated, setIsHydrated] = useState(false)

  useEffect(() => {
    setIsHydrated(true)
  }, [])

  // Render children immediately - Zustand handles its own hydration
  // This component can be extended if you need custom hydration logic
  return <>{children}</>
}

/**
 * Hook to check if stores are hydrated
 * Useful for preventing flash of incorrect content
 */
export function useStoreHydration(): boolean {
  const [isHydrated, setIsHydrated] = useState(false)

  useEffect(() => {
    setIsHydrated(true)
  }, [])

  return isHydrated
}
