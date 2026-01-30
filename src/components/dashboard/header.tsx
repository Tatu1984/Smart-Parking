'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, Search, Moon, Sun, Menu, Ticket, Car, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { useTheme } from 'next-themes'
import { useDashboardStore, useUIStore } from '@/store'
import { toast } from 'sonner'
import { logger } from '@/lib/logger'

interface Notification {
  id: string
  title: string
  message: string
  type: string
  createdAt: string
  read: boolean
}

interface SearchResult {
  id: string
  type: 'token' | 'vehicle'
  title: string
  subtitle: string
}

interface HeaderProps {
  parkingLots?: { id: string; name: string }[]
}

export function Header({ parkingLots = [] }: HeaderProps) {
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const { selectedParkingLotId, setSelectedParkingLot } = useDashboardStore()
  const { toggleSidebar } = useUIStore()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)

  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null)

  // Debounced search function
  const performSearch = useCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setSearchResults([])
      setSearchLoading(false)
      return
    }

    setSearchLoading(true)
    try {
      // Search tokens and vehicles in parallel
      const [tokensRes, vehiclesRes] = await Promise.all([
        fetch(`/api/tokens?search=${encodeURIComponent(query)}&limit=5`),
        fetch(`/api/vehicles?search=${encodeURIComponent(query)}&limit=5`),
      ])

      const results: SearchResult[] = []

      const tokensData = await tokensRes.json()
      if (tokensData.success && tokensData.data) {
        tokensData.data.forEach((token: { id: string; tokenNumber: string; licensePlate?: string; status: string }) => {
          results.push({
            id: token.id,
            type: 'token',
            title: token.tokenNumber,
            subtitle: `${token.licensePlate || 'No plate'} - ${token.status}`,
          })
        })
      }

      const vehiclesData = await vehiclesRes.json()
      if (vehiclesData.success && vehiclesData.data) {
        vehiclesData.data.forEach((vehicle: { id: string; licensePlate: string; vehicleType: string }) => {
          results.push({
            id: vehicle.id,
            type: 'vehicle',
            title: vehicle.licensePlate,
            subtitle: vehicle.vehicleType,
          })
        })
      }

      setSearchResults(results)
    } catch (error) {
      logger.debug('Search failed')
      setSearchResults([])
    } finally {
      setSearchLoading(false)
    }
  }, [])

  // Handle search input with debouncing
  const handleSearchChange = (value: string) => {
    setSearchQuery(value)

    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current)
    }

    searchDebounceRef.current = setTimeout(() => {
      performSearch(value)
    }, 300)
  }

  // Handle search result selection
  const handleSelectResult = (result: SearchResult) => {
    setSearchOpen(false)
    setSearchQuery('')
    setSearchResults([])

    if (result.type === 'token') {
      router.push(`/dashboard/tokens?id=${result.id}`)
    } else {
      router.push(`/dashboard/vehicles?id=${result.id}`)
    }
  }

  const fetchNotifications = useCallback(async () => {
    try {
      const response = await fetch('/api/notifications?unread=true&limit=5')
      if (response.ok) {
        const data = await response.json()
        if (data.success && data.data) {
          setNotifications(data.data)
          setUnreadCount(data.pagination?.total || data.data.length)
        }
      }
    } catch (error) {
      logger.debug('Failed to fetch notifications')
    }
  }, [])

  useEffect(() => {
    fetchNotifications()
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchNotifications, 30000)
    return () => clearInterval(interval)
  }, [fetchNotifications])

  const getTimeAgo = (dateStr: string) => {
    const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
    if (seconds < 60) return 'Just now'
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes} min ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    return `${Math.floor(hours / 24)}d ago`
  }

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
    <header className="sticky top-0 z-50 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6">
      {/* Mobile menu button */}
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={toggleSidebar}
        aria-label="Toggle navigation menu"
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Parking Lot Selector */}
      <Select
        value={selectedParkingLotId || ''}
        onValueChange={setSelectedParkingLot}
      >
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder="Select Parking Lot" />
        </SelectTrigger>
        <SelectContent>
          {parkingLots.map((lot) => (
            <SelectItem key={lot.id} value={lot.id}>
              {lot.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Search */}
      <Popover open={searchOpen} onOpenChange={setSearchOpen}>
        <PopoverTrigger asChild>
          <div className="relative hidden flex-1 md:flex md:max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search tokens, vehicles..."
              className="pl-8"
              value={searchQuery}
              onChange={(e) => {
                handleSearchChange(e.target.value)
                if (e.target.value) setSearchOpen(true)
              }}
              onFocus={() => searchQuery && setSearchOpen(true)}
            />
            {searchLoading && (
              <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>
        </PopoverTrigger>
        <PopoverContent className="w-[320px] p-0" align="start">
          <Command>
            <CommandList>
              {searchResults.length === 0 && !searchLoading && searchQuery.length >= 2 && (
                <CommandEmpty>No results found.</CommandEmpty>
              )}
              {searchResults.length > 0 && (
                <>
                  <CommandGroup heading="Tokens">
                    {searchResults
                      .filter((r) => r.type === 'token')
                      .map((result) => (
                        <CommandItem
                          key={result.id}
                          onSelect={() => handleSelectResult(result)}
                          className="cursor-pointer"
                        >
                          <Ticket className="mr-2 h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="font-medium">{result.title}</p>
                            <p className="text-xs text-muted-foreground">{result.subtitle}</p>
                          </div>
                        </CommandItem>
                      ))}
                  </CommandGroup>
                  <CommandGroup heading="Vehicles">
                    {searchResults
                      .filter((r) => r.type === 'vehicle')
                      .map((result) => (
                        <CommandItem
                          key={result.id}
                          onSelect={() => handleSelectResult(result)}
                          className="cursor-pointer"
                        >
                          <Car className="mr-2 h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="font-medium">{result.title}</p>
                            <p className="text-xs text-muted-foreground">{result.subtitle}</p>
                          </div>
                        </CommandItem>
                      ))}
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <div className="ml-auto flex items-center gap-2">
        {/* Theme Toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          aria-label="Toggle dark mode"
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>

        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative" aria-label="View notifications">
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <Badge
                  variant="destructive"
                  className="absolute -right-1 -top-1 h-5 w-5 rounded-full p-0 text-xs"
                >
                  {unreadCount > 9 ? '9+' : unreadCount}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel>Notifications</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {notifications.length > 0 ? (
              notifications.map((notification) => (
                <DropdownMenuItem
                  key={notification.id}
                  className="flex flex-col items-start gap-1 cursor-pointer"
                  onClick={() => router.push('/dashboard/settings')}
                >
                  <span className="font-medium">{notification.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {notification.message} - {getTimeAgo(notification.createdAt)}
                  </span>
                </DropdownMenuItem>
              ))
            ) : (
              <DropdownMenuItem className="text-center text-sm text-muted-foreground">
                No new notifications
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-center text-sm text-muted-foreground cursor-pointer"
              onClick={() => router.push('/dashboard/settings')}
            >
              View all notifications
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-8 w-8 rounded-full">
              <Avatar className="h-8 w-8">
                <AvatarImage src="/avatar.png" alt="User" />
                <AvatarFallback>AD</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium">Admin User</p>
                <p className="text-xs text-muted-foreground">admin@sparking.io</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="cursor-pointer" onClick={() => router.push('/dashboard/settings')}>
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer" onClick={() => router.push('/dashboard/settings')}>
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive cursor-pointer"
              onClick={handleLogout}
            >
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
