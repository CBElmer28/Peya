"use client"

import { useEffect, useState } from "react"
import { ArrowLeftRight, BellRing, FileText, LogIn, RefreshCw, ShieldAlert, Wallet } from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuth } from "@/components/auth-provider"
import { getNotificationsApi } from "@/lib/api-client"
import type { AppNotification } from "@/lib/mock-api"
import type { DashboardViewKey } from "@/components/dashboard-sidebar"

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
  compact = true,
  onNavigate,
}: {
  onUnreadCountChange?: (count: number) => void
  compact?: boolean
  onNavigate?: (view: DashboardViewKey) => void
}) {
  const { session } = useAuth()
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    let active = true
    if (!session) {
      setNotifications([])
      setError(false)
      setLoading(false)
      onUnreadCountChange?.(0)
      return () => {
        active = false
      }
    }

    setLoading(true)
    setError(false)
    getNotificationsApi(session.token)
      .then((data) => {
        if (!active) return
        setNotifications(data)
        onUnreadCountChange?.(data.filter((notification) => notification.unread).length)
      })
      .catch((err) => {
        console.error("Error cargando notificaciones:", err)
        if (!active) return
        setError(true)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [session, retryCount, onUnreadCountChange])

  const unreadCount = notifications.filter((n) => n.unread).length

  function markAllRead() {
    // TODO: notification-service · PATCH /notifications/read-all
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })))
    onUnreadCountChange?.(0)
  }

  return (
    <section
      aria-labelledby="notificaciones-title"
      className={cn(
        "flex flex-col rounded-xl border border-white/10 bg-brand-surface p-5 shadow-sm",
        compact ? "" : "p-6 sm:p-8",
      )}
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

      {!compact ? (
        <p className="mb-6 text-sm text-brand-muted">
          Mantente al día con la actividad y las transferencias de tus cuentas.
        </p>
      ) : null}

      {loading && notifications.length === 0 ? (
        <div className="flex flex-col gap-3" role="status" aria-label="Cargando notificaciones">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-brand-surface-2" />
          ))}
          <span className="sr-only">Cargando notificaciones…</span>
        </div>
      ) : error ? (
        <div className="rounded-xl border border-brand-negative/30 bg-brand-negative/10 p-5 text-center" role="alert">
          <p className="text-sm font-semibold text-brand-text">No pudimos cargar tus notificaciones.</p>
          <p className="mt-1 text-xs text-brand-muted">Revisa tu conexión e inténtalo nuevamente.</p>
          <button
            type="button"
            onClick={() => setRetryCount((count) => count + 1)}
            className="mt-4 inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm font-semibold text-brand-text transition-colors hover:bg-white/5"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Reintentar
          </button>
        </div>
      ) : notifications.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 px-5 py-10 text-center">
          <BellRing className="mx-auto h-8 w-8 text-brand-muted" aria-hidden="true" />
          <p className="mt-3 text-sm font-semibold text-brand-text">No tienes notificaciones</p>
          <p className="mt-1 text-xs text-brand-muted">Aquí aparecerán las novedades de tus cuentas.</p>
        </div>
      ) : (
        <ul className={cn("flex flex-col", compact ? "gap-4" : "divide-y divide-white/10")}>
          {notifications.map((n) => (
            <li key={n.id} className={cn("flex gap-3", compact ? "" : "py-5 first:pt-0 last:pb-0")}>
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
                {n.type === "transfer" && (n.transferOrigin || n.amount || n.date || n.receivingAccount) ? (
                  <dl className="mt-2 grid gap-x-5 gap-y-2 text-xs sm:grid-cols-2">
                    {n.transferOrigin ? (
                      <div>
                        <dt className="text-brand-muted">Origen</dt>
                        <dd className="mt-0.5 break-words font-medium text-brand-light">{n.transferOrigin}</dd>
                      </div>
                    ) : null}
                    {n.amount && n.currency ? (
                      <div>
                        <dt className="text-brand-muted">Monto · {n.currency}</dt>
                        <dd className="mt-0.5 font-semibold text-brand-positive">
                          {new Intl.NumberFormat("es-PE", {
                            style: "currency",
                            currency: n.currency,
                          }).format(Number(n.amount))}
                        </dd>
                      </div>
                    ) : null}
                    {n.receivingAccount ? (
                      <div>
                        <dt className="text-brand-muted">Cuenta receptora</dt>
                        <dd className="mt-0.5 break-words font-medium text-brand-light">{n.receivingAccount}</dd>
                      </div>
                    ) : null}
                    {n.date ? (
                      <div>
                        <dt className="text-brand-muted">Fecha</dt>
                        <dd className="mt-0.5 font-medium text-brand-light">
                          {formatNotificationDate(n.date)}
                        </dd>
                      </div>
                    ) : null}
                  </dl>
                ) : (
                  <p className="text-xs text-brand-muted">{n.detail}</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {compact ? (
        <button
          type="button"
          onClick={() => onNavigate?.("notifications")}
          className="mt-5 flex w-full items-center justify-center rounded-lg border border-white/10 bg-brand-surface-2/60 px-4 py-2.5 text-sm font-semibold text-brand-text transition-colors hover:border-white/20 hover:bg-white/5"
        >
          Ver historial completo
        </button>
      ) : null}
    </section>
  )
}

function formatNotificationDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat("es-PE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date)
}
