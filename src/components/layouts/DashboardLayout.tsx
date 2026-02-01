'use client'

import { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/store'
import { SidebarProvider } from '@/components/ui/sidebar'

interface DashboardLayoutProps {
  children: ReactNode
  sidebar?: ReactNode
  header?: ReactNode
  className?: string
}

export function DashboardLayout({
  children,
  sidebar,
  header,
  className,
}: DashboardLayoutProps) {
  const { sidebarOpen, sidebarCollapsed } = useUIStore()

  return (
    <SidebarProvider defaultOpen={sidebarOpen}>
      <div className={cn('flex min-h-screen w-full', className)}>
        {sidebar}
        <div className="flex flex-1 flex-col">
          {header}
          <main className="flex-1 p-4 md:p-6">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  )
}
