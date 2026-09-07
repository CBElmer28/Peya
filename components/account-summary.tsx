"use client"

import { useEffect, useState } from "react"
import { Wallet, PiggyBank, TrendingUp, ArrowUpRight, ArrowDownRight } from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { getAccounts, type Account } from "@/lib/mock-api"

const ICONS = { wallet: Wallet, savings: PiggyBank, investment: TrendingUp } as const

export function AccountSummary() {
  const { session } = useAuth()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!session) return
    let active = true
    getAccounts(session.token).then((data) => {
      if (!active) return
      setAccounts(data)
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [session])

  return (
    <section aria-labelledby="resumen-title">
      <h2 id="resumen-title" className="mb-4 text-xl font-bold text-brand-text md:text-2xl">
        Resumen de cuentas
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {loading && accounts.length === 0
          ? Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-40 animate-pulse rounded-xl border border-white/10 bg-brand-surface" />
            ))
          : accounts.map((acc) => {
              const Icon = ICONS[acc.icon]
              const TrendIcon = acc.trendDirection === "up" ? ArrowUpRight : ArrowDownRight
              return (
                <article
                  key={acc.id}
                  className="rounded-xl border border-white/10 bg-brand-surface p-5 shadow-sm transition-colors hover:bg-brand-surface-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 text-brand-muted">
                      <Icon className="h-4 w-4" aria-hidden="true" />
                      <p className="text-sm font-medium">{acc.label}</p>
                    </div>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-positive/15 px-2.5 py-1 text-xs font-semibold text-brand-positive">
                      <span className="h-1.5 w-1.5 rounded-full bg-brand-positive" aria-hidden="true" />
                      Activo
                    </span>
                  </div>

                  <p className="mt-3 text-2xl font-bold tracking-tight text-brand-text">{acc.balance}</p>
                  <p className="mt-1 text-xs text-brand-muted">CCI {acc.cci}</p>
                  <p className="mt-2 text-sm text-brand-light/70">{acc.subtitleDetail}</p>

                  <div
                    className={
                      "mt-3 flex items-center gap-1 text-xs font-semibold " +
                      (acc.trendDirection === "up" ? "text-brand-positive" : "text-brand-negative")
                    }
                  >
                    <TrendIcon className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{acc.trendLabel}</span>
                  </div>
                </article>
              )
            })}
      </div>
    </section>
  )
}
