"use client"

import { useEffect, useState } from "react"
import { DashboardHeader } from "@/components/dashboard-header"
import { DashboardSidebar, type DashboardViewKey } from "@/components/dashboard-sidebar"
import { AccountSummary } from "@/components/account-summary"
import { AccountsView } from "@/components/accounts-view"
import { MovementsView } from "@/components/movements-view"
import { RecentMovements } from "@/components/recent-movements"
import { NotificationsPanel } from "@/components/notifications-panel"
import { ProfileView } from "@/components/profile-view"
import { TransferFlow } from "@/components/transfer-flow"
import { AdminModule } from "@/components/admin-module"
import { useAuth } from "@/components/auth-provider"
import { getNotifications } from "@/lib/mock-api"

export function DashboardView() {
  const { session } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [view, setView] = useState<DashboardViewKey>("home")
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0)

  useEffect(() => {
    if (!session) {
      setUnreadNotificationsCount(0)
      return
    }

    let active = true
    getNotifications(session.token).then((items) => {
      if (!active) return
      setUnreadNotificationsCount(items.filter((item) => item.unread).length)
    })

    return () => {
      active = false
    }
  }, [session])

  function handleNavigate(next: DashboardViewKey) {
    setView(next)
    setSidebarOpen(false)
  }

  return (
    <div className="min-h-screen bg-brand-bg text-brand-text">
      <DashboardHeader onMenuClick={() => setSidebarOpen((v) => !v)} activeView={view} onNavigate={handleNavigate} />
      <DashboardSidebar
        open={sidebarOpen}
        activeView={view}
        onNavigate={handleNavigate}
        unreadNotificationsCount={unreadNotificationsCount}
      />

      {sidebarOpen && (
        <button
          type="button"
          aria-label="Cerrar menú"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
        />
      )}

      <main className="px-4 pb-10 pt-20 md:pl-64 md:pr-6">
        <div className="mx-auto max-w-6xl space-y-6">
          {view === "cards" ? (
            <AccountsView />
          ) : view === "movements" ? (
            <MovementsView />
          ) : view === "profile" ? (
            <ProfileView />
          ) : view === "transfers" ? (
            <TransferFlow />
          ) : view === "admin" ? (
            <AdminModule />
          ) : (
            <>
              <AccountSummary />

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <div className="lg:col-span-2">
                  <RecentMovements />
                </div>
                <div className="lg:col-span-1">
                  <NotificationsPanel onUnreadCountChange={setUnreadNotificationsCount} />
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
