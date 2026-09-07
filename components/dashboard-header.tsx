"use client"

import { useEffect, useRef, useState } from "react"
import { Menu, LogOut, ChevronDown } from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import type { DashboardViewKey } from "@/components/dashboard-sidebar"

const VIEW_TITLES: Record<DashboardViewKey, string> = {
  home: "Dashboard",
  cards: "Cuentas",
  movements: "Movimientos",
  transfers: "Transferencias",
  admin: "Administración",
  notifications: "Notificaciones",
  profile: "Perfil",
}

const WEEKDAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"]
const MONTHS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "setiembre",
  "octubre",
  "noviembre",
  "diciembre",
]

function formatToday(): string {
  const now = new Date()
  const weekday = WEEKDAYS[now.getDay()].charAt(0).toUpperCase() + WEEKDAYS[now.getDay()].slice(1)
  const month = MONTHS[now.getMonth()].charAt(0).toUpperCase() + MONTHS[now.getMonth()].slice(1)
  return `${weekday}, ${now.getDate()} De ${month} De ${now.getFullYear()}`
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  const initials = parts.slice(0, 2).map((p) => p.charAt(0).toUpperCase())
  return initials.join("") || "U"
}

export function DashboardHeader({
  onMenuClick,
  activeView,
  onNavigate,
}: {
  onMenuClick: () => void
  activeView: DashboardViewKey
  onNavigate: (view: DashboardViewKey) => void
}) {
  const { session, signOut } = useAuth()
  const userName = session?.user.name ?? "Usuario"
  const role = activeView === "admin" ? "Administrador" : "Titular de cuenta"
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false)
    }

    document.addEventListener("mousedown", handleClickOutside)
    document.addEventListener("keydown", handleEscape)

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("keydown", handleEscape)
    }
  }, [])

  return (
    <header className="fixed inset-x-0 top-0 z-50 flex h-16 items-center justify-between gap-4 border-b border-white/10 bg-brand-surface px-4 md:pl-64 md:pr-6">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-brand-text transition-colors duration-150 hover:bg-white/10 md:hidden"
          aria-label="Abrir menú de navegación"
        >
          <Menu className="h-6 w-6" aria-hidden="true" />
        </button>

        <div className="min-w-0">
          <h1 className="truncate text-base font-bold leading-tight text-brand-text sm:text-lg">
            {VIEW_TITLES[activeView]}
          </h1>
          <p className="truncate text-xs text-brand-muted">{formatToday()}</p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((value) => !value)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 transition-colors duration-150 hover:bg-white/5"
          >
          <span
            className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-accent text-sm font-bold text-brand-bg"
            aria-hidden="true"
          >
            {getInitials(userName)}
          </span>
          <span className="hidden text-left sm:block">
            <span className="block text-sm font-semibold leading-tight text-brand-text">{userName}</span>
            <span className="block text-xs leading-tight text-brand-muted">{role}</span>
          </span>
            <ChevronDown className="hidden h-4 w-4 text-brand-muted sm:block" aria-hidden="true" />
          </button>

          {menuOpen ? (
            <div
              role="menu"
              className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-48 overflow-hidden rounded-xl border border-white/10 bg-brand-surface shadow-2xl shadow-black/30"
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false)
                  onNavigate("profile")
                }}
                className="flex w-full items-center px-4 py-3 text-left text-sm text-brand-text transition-colors duration-150 hover:bg-white/5"
              >
                Ver perfil
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false)
                  signOut()
                }}
                className="flex w-full items-center px-4 py-3 text-left text-sm text-brand-negative transition-colors duration-150 hover:bg-white/5"
              >
                Cerrar sesión
              </button>
            </div>
          ) : null}
        </div>

        <button
          type="button"
          onClick={signOut}
          className="flex h-10 items-center gap-2 rounded-xl px-3 text-sm font-medium text-brand-muted transition-colors duration-150 hover:bg-white/10 hover:text-brand-text"
          aria-label="Cerrar sesión"
        >
          <LogOut className="h-5 w-5" aria-hidden="true" />
          <span className="sr-only sm:not-sr-only">Salir</span>
        </button>
      </div>
    </header>
  )
}
