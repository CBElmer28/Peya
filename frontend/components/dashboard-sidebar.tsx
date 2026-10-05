"use client"

import { Home, CreditCard, List, ArrowLeftRight, Bell, User, ShieldCheck, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"

export type DashboardViewKey =
  | "home"
  | "cards"
  | "movements"
  | "transfers"
  | "notifications"
  | "profile"
  | "admin"

const navItems: { key: DashboardViewKey; icon: typeof Home; label: string }[] = [
  { key: "home", icon: Home, label: "Inicio" },
  { key: "cards", icon: CreditCard, label: "Cuentas" },
  { key: "movements", icon: List, label: "Movimientos" },
  { key: "transfers", icon: ArrowLeftRight, label: "Transferencias" },
  { key: "admin", icon: ShieldCheck, label: "Administración" },
  { key: "notifications", icon: Bell, label: "Notificaciones" },
  { key: "profile", icon: User, label: "Perfil" },
]

export function DashboardSidebar({
  open,
  activeView,
  onNavigate,
  unreadNotificationsCount,
}: {
  open: boolean
  activeView: DashboardViewKey
  onNavigate: (view: DashboardViewKey) => void
  unreadNotificationsCount: number
}) {
  const principalItems = navItems.filter((item) => ["home", "cards", "movements", "transfers"].includes(item.key))
  const accountItems = navItems.filter((item) => ["admin", "notifications", "profile"].includes(item.key))

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-brand-surface-2 bg-brand-surface transition-transform duration-300 md:translate-x-0",
        open ? "translate-x-0" : "-translate-x-full",
      )}
    >
      <div className="flex items-center gap-2.5 border-b border-white/10 px-4 py-4">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-accent" aria-hidden="true">
          <span className="text-sm font-bold text-brand-bg">B</span>
        </span>
        <span className="text-lg font-bold tracking-tight text-brand-text">Peya</span>
      </div>

      <nav className="flex flex-1 flex-col gap-7 overflow-y-auto p-3">
        <div>
          <p className="px-3 pb-2 pt-3 text-xs font-semibold uppercase tracking-wider text-brand-muted">PRINCIPAL</p>
          <div className="flex flex-col gap-1">
            {principalItems.map((item) => {
              const Icon = item.icon
              const active = item.key === activeView
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => onNavigate(item.key)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-150",
                    active
                      ? "bg-brand-accent/10 text-brand-accent"
                      : "text-brand-muted hover:bg-white/5 hover:text-brand-text",
                  )}
                >
                  {active && (
                    <span className="absolute inset-y-1.5 left-0 w-1 rounded-r-full bg-brand-accent" aria-hidden="true" />
                  )}
                  <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                  <span>{item.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <p className="px-3 pb-2 pt-3 text-xs font-semibold uppercase tracking-wider text-brand-muted">CUENTA</p>
          <div className="flex flex-col gap-1">
            {accountItems.map((item) => {
              const Icon = item.icon
              const active = item.key === activeView
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => onNavigate(item.key)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-150",
                    active
                      ? "bg-brand-accent/10 text-brand-accent"
                      : "text-brand-muted hover:bg-white/5 hover:text-brand-text",
                  )}
                >
                  {active && (
                    <span className="absolute inset-y-1.5 left-0 w-1 rounded-r-full bg-brand-accent" aria-hidden="true" />
                  )}
                  <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                  <span>{item.label}</span>
                  {item.key === "notifications" && unreadNotificationsCount > 0 ? (
                    <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-negative px-1 text-[11px] font-bold leading-none text-white">
                      {unreadNotificationsCount}
                    </span>
                  ) : null}
                </button>
              )
            })}
          </div>
        </div>
      </nav>

      <div className="p-3">
        <div className="rounded-xl border border-white/10 bg-gradient-to-br from-brand-accent/15 via-brand-surface-2/70 to-transparent p-4 shadow-sm shadow-black/10">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-accent/15 text-brand-accent" aria-hidden="true">
              <Sparkles className="h-4 w-4" />
            </span>
            <p className="text-sm font-semibold text-brand-text">Plan Estándar</p>
          </div>
          <p className="mt-1 text-xs text-brand-muted">Cuenta activa · verificada</p>
          <button
            type="button"
            className="mt-3 w-full rounded-xl border border-brand-accent/30 py-2 text-xs font-semibold text-brand-accent transition-colors duration-150 hover:bg-brand-accent/90 hover:text-brand-bg hover:shadow-md hover:shadow-black/20"
          >
            Mejorar plan
          </button>
        </div>
      </div>
    </aside>
  )
}
