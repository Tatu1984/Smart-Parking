import { SidebarNav } from '@/components/dashboard/sidebar-nav'
import { Header } from '@/components/dashboard/header'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // In production, fetch parking lots from API based on user
  const parkingLots = [
    { id: 'lot-1', name: 'Airport Terminal 1' },
    { id: 'lot-2', name: 'City Mall Parking' },
    { id: 'lot-3', name: 'Central Plaza' },
  ]

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="hidden md:flex">
        <SidebarNav />
      </aside>

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header parkingLots={parkingLots} />
        <main className="flex-1 overflow-y-auto bg-muted/30 p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
