'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  ParkingSquare,
  Camera,
  MapPin,
  Ticket,
  Car,
  CreditCard,
  BarChart3,
  FileText,
  Settings,
  Users,
  Bell,
  HelpCircle,
  ChevronLeft,
  LogOut,
  Building2,
  Wallet,
  ArrowLeftRight,
  Landmark,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useUIStore } from '@/store'
import { toast } from 'sonner'
import { logger } from '@/lib/logger'

const navigation = [
  {
    title: 'Overview',
    items: [
      { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      { name: 'Live View', href: '/dashboard/live', icon: Camera },
    ],
  },
  {
    title: 'Parking Management',
    items: [
      { name: 'Parking Lots', href: '/dashboard/parking-lots', icon: Building2 },
      { name: 'Zones', href: '/dashboard/zones', icon: MapPin },
      { name: 'Slots', href: '/dashboard/slots', icon: ParkingSquare },
      { name: 'Cameras', href: '/dashboard/cameras', icon: Camera },
    ],
  },
  {
    title: 'Operations',
    items: [
      { name: 'Tokens', href: '/dashboard/tokens', icon: Ticket },
      { name: 'Vehicles', href: '/dashboard/vehicles', icon: Car },
      { name: 'Transactions', href: '/dashboard/transactions', icon: CreditCard },
    ],
  },
  {
    title: 'Finance',
    items: [
      { name: 'Wallet', href: '/dashboard/wallet', icon: Wallet },
      { name: 'Transfers', href: '/dashboard/wallet/transfer', icon: ArrowLeftRight },
      { name: 'Bank Accounts', href: '/dashboard/wallet/bank-accounts', icon: Landmark },
    ],
  },
  {
    title: 'Insights',
    items: [
      { name: 'Analytics', href: '/dashboard/analytics', icon: BarChart3 },
      { name: 'Reports', href: '/dashboard/reports', icon: FileText },
    ],
  },
  {
    title: 'System',
    items: [
      { name: 'Settings', href: '/dashboard/settings', icon: Settings },
      { name: 'Users', href: '/dashboard/settings/users', icon: Users },
      { name: 'Alerts', href: '/dashboard/settings', icon: Bell },
    ],
  },
]

export function SidebarNav() {
  const pathname = usePathname()
  const router = useRouter()
  const { sidebarCollapsed, setSidebarCollapsed } = useUIStore()

  const handleLogout = async () => {
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      })

      if (response.ok) {
        toast.success('Logged out successfully')
        router.push('/login')
        router.refresh()
      } else {
        toast.error('Failed to logout')
      }
    } catch (error) {
      logger.error('Logout error:', error instanceof Error ? error : undefined)
      toast.error('Failed to logout')
    }
  }

  return (
    <TooltipProvider delayDuration={0}>
      <div
        className={cn(
          'flex h-full flex-col border-r bg-background transition-all duration-300',
          sidebarCollapsed ? 'w-16' : 'w-64'
        )}
      >
        {/* Header */}
        <div className="flex h-16 items-center justify-between border-b px-4">
          {!sidebarCollapsed && (
            <Link href="/dashboard" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <ParkingSquare className="h-5 w-5" />
              </div>
              <span className="font-semibold">Sparking</span>
            </Link>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          >
            <ChevronLeft
              className={cn(
                'h-4 w-4 transition-transform',
                sidebarCollapsed && 'rotate-180'
              )}
            />
          </Button>
        </div>

        {/* Navigation */}
        <ScrollArea className="flex-1 py-4">
          <nav className="space-y-6 px-2">
            {navigation.map((group) => (
              <div key={group.title}>
                {!sidebarCollapsed && (
                  <h4 className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {group.title}
                  </h4>
                )}
                <div className="space-y-1">
                  {group.items.map((item) => {
                    const isActive = pathname === item.href ||
                      (item.href !== '/dashboard' && pathname.startsWith(item.href))

                    const linkContent = (
                      <Link
                        href={item.href}
                        className={cn(
                          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                          isActive
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                          sidebarCollapsed && 'justify-center px-2'
                        )}
                      >
                        <item.icon className="h-4 w-4 shrink-0" />
                        {!sidebarCollapsed && <span>{item.name}</span>}
                      </Link>
                    )

                    if (sidebarCollapsed) {
                      return (
                        <Tooltip key={item.name}>
                          <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                          <TooltipContent side="right">
                            {item.name}
                          </TooltipContent>
                        </Tooltip>
                      )
                    }

                    return <div key={item.name}>{linkContent}</div>
                  })}
                </div>
              </div>
            ))}
          </nav>
        </ScrollArea>

        {/* Footer */}
        <div className="border-t p-2">
          <div className="space-y-1">
            {sidebarCollapsed ? (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="w-full">
                      <HelpCircle className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">Help</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-full text-destructive"
                      onClick={handleLogout}
                    >
                      <LogOut className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">Logout</TooltipContent>
                </Tooltip>
              </>
            ) : (
              <>
                <Button variant="ghost" className="w-full justify-start gap-3">
                  <HelpCircle className="h-4 w-4" />
                  Help & Support
                </Button>
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-3 text-destructive hover:text-destructive"
                  onClick={handleLogout}
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}
