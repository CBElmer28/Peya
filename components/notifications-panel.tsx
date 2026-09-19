"use client"

import { useEffect, useState } from "react"
import { ArrowLeftRight, BellRing, FileText, LogIn, ShieldAlert, Wallet } from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuth } from "@/components/auth-provider"
import { getNotificationsApi } from "@/lib/api-client"
import type { AppNotification } from "@/lib/mock-api"

const NOTIFICATION_CONFIG: Record<
  AppNotification["type"],
  { icon: typeof ArrowLeftRight; bgClass: string; iconClass: string }
> = {
  transfer: { icon: ArrowLeftRight, bgClass: "bg-emerald-500/15", iconClass: "text-emerald-400" },
  login: { icon: LogIn, bgClass: "bg-violet-500/15", iconClass: "text-violet-400" },
  document: { icon: FileText, bgClass: "bg-sky-500/15", iconClass: "text-sky-400" },
  payment: { icon: Wallet, bgClass: "bg-emerald-500/15", iconClass: "text-emerald-400" },
  alert: { icon: ShieldAlert, bgClass: "bg-amber-500/15", iconClass: "text-amber-400" },
  deposit: { icon: BellRing, bgClass: "bg-teal-500/15", iconClass: "text-teal-400" },
}

export function NotificationsPanel({
  onUnreadCountChange,
}: {
  onUnreadCountChange?: (count: number) => void
}) {
  const { session } = useAuth()
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!session) return
    let active = true
    getNotificationsApi(session.token)
      .then((data) => {
        if (!active) return
        setNotifications(data)
        onUnreadCountChange?.(data.filter((notification) => notification.unread).length)
        setLoading(false)
      })
      .catch((err) => {
        console.error("Error cargando notificaciones:", err)
        if (!active) return
        setLoading(false)
      })
    return () => {
      active = false
    }
  }, [session])

  const unreadCount = notifications.filter((n) => n.unread).length

  function markAllRead() {
    // TODO: notification-service · PATCH /notifications/read-all
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })))
    onUnreadCountChange?.(0)
  }

  return (
    <section
      aria-labelledby="notificaciones-title"
      className="flex flex-col rounded-xl border border-white/10 bg-brand-surface p-5 shadow-sm"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 id="notificaciones-title" className="text-lg font-bold text-brand-text">
            Notificaciones
          </h2>
          {unreadCount > 0 ? (
            <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-brand-negative px-1.5 text-[11px] font-bold leading-none text-white">
              {unreadCount}
            </span>
          ) : null}
        </div>
        <button
          type="button"
          onClick={markAllRead}
          disabled={unreadCount === 0}
          className="shrink-0 text-xs font-semibold text-brand-accent transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Marcar todas leídas
        </button>
      </div>

      {loading && notifications.length === 0 ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-10 animate-pulse rounded-lg bg-brand-surface-2" />
          ))}
        </div>
      ) : (
        <ul className="flex flex-col gap-4">
          {notifications.map((n) => (
            <li key={n.id} className="flex gap-3">
              <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", NOTIFICATION_CONFIG[n.type].bgClass)} aria-hidden="true">
                {(() => {
                  const Icon = NOTIFICATION_CONFIG[n.type].icon
                  return <Icon className={cn("h-4 w-4", NOTIFICATION_CONFIG[n.type].iconClass)} aria-hidden="true" />
                })()}
              </span>
              <div className="min-w-0">
                <p className={cn("text-sm leading-relaxed", n.unread ? "font-semibold text-brand-text" : "text-brand-light/80")}>
                  {n.title}
                </p>
                <p className="text-xs text-brand-muted">{n.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        className="mt-5 flex w-full items-center justify-center rounded-lg border border-white/10 bg-brand-surface-2/60 px-4 py-2.5 text-sm font-semibold text-brand-text transition-colors hover:border-white/20 hover:bg-white/5"
      >
        Ver historial completo
      </button>
    </section>
  )
}
