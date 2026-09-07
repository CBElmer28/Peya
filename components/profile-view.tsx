"use client"

import { useState } from "react"
import { CalendarDays, CreditCard, Mail, ShieldCheck, Smartphone, Laptop, User } from "lucide-react"
import { useAuth } from "@/components/auth-provider"

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "U"
}

function Switch({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={onToggle}
      className={[
        "inline-flex h-7 w-12 items-center rounded-full p-1 transition-colors duration-150",
        enabled ? "bg-brand-accent" : "bg-brand-surface-2",
      ].join(" ")}
    >
      <span
        className={[
          "h-5 w-5 rounded-full bg-brand-bg shadow-sm transition-transform duration-150",
          enabled ? "translate-x-5" : "translate-x-0",
        ].join(" ")}
      />
    </button>
  )
}

function SectionCard({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border border-white/10 bg-brand-surface p-5">
      <h2 className="text-base font-semibold text-brand-text">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  )
}

export function ProfileView() {
  const { session } = useAuth()
  const fullName = session?.user.name ?? "Usuario BankHub"
  const email = session?.user.email ?? "usuario@bankhub.com"
  const initials = getInitials(fullName)
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false)
  const [emailNotifications, setEmailNotifications] = useState(true)
  const [pushNotifications, setPushNotifications] = useState(false)
  const [weeklySummary, setWeeklySummary] = useState(true)

  return (
    <section className="space-y-6" aria-labelledby="profile-title">
      <div>
        <h1 id="profile-title" className="text-2xl font-bold text-brand-text">
          Mi perfil
        </h1>
        <p className="text-sm text-brand-muted">Administra tu información y preferencias de cuenta</p>
      </div>

      <section className="rounded-xl border border-white/10 bg-brand-surface p-5">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <span className="flex h-20 w-20 items-center justify-center rounded-full bg-brand-accent text-2xl font-bold text-brand-bg">
              {initials}
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-bold text-brand-text">{fullName}</h2>
                <span className="inline-flex items-center rounded-full bg-brand-positive/15 px-2.5 py-1 text-xs font-semibold text-brand-positive">
                  Titular de cuenta
                </span>
              </div>
              <p className="mt-1 text-sm text-brand-muted">{email}</p>
              <p className="mt-1 text-xs text-brand-muted">Cliente desde 2024</p>
            </div>
          </div>

          <button type="button" className="btn-secondary inline-flex items-center gap-2 self-start sm:self-auto">
            <User className="h-4 w-4" aria-hidden="true" />
            Editar perfil
          </button>
        </div>
      </section>

      <div className="space-y-6">
        <SectionCard title="Seguridad">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-surface-2 text-brand-accent">
                  <CreditCard className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                  <p className="font-medium text-brand-text">Contraseña</p>
                  <p className="text-xs text-brand-muted">Actualiza tu clave de acceso</p>
                </div>
              </div>
              <button type="button" className="rounded-xl border border-white/10 px-3 py-2 text-sm font-medium text-brand-text transition-colors duration-150 hover:bg-white/5">
                Cambiar
              </button>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-surface-2 text-brand-accent">
                  <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                  <p className="font-medium text-brand-text">Verificación en dos pasos</p>
                  <p className="text-xs text-brand-muted">Protege tu acceso con un paso extra</p>
                </div>
              </div>
              <Switch enabled={twoFactorEnabled} onToggle={() => setTwoFactorEnabled((value) => !value)} />
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Preferencias de notificaciones">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-surface-2 text-brand-accent">
                  <Mail className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                  <p className="font-medium text-brand-text">Notificaciones por correo</p>
                  <p className="text-xs text-brand-muted">Alertas sobre movimientos y seguridad</p>
                </div>
              </div>
              <Switch enabled={emailNotifications} onToggle={() => setEmailNotifications((value) => !value)} />
            </div>

            <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-surface-2 text-brand-accent">
                  <Smartphone className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                  <p className="font-medium text-brand-text">Notificaciones push</p>
                  <p className="text-xs text-brand-muted">Recibe avisos en el móvil</p>
                </div>
              </div>
              <Switch enabled={pushNotifications} onToggle={() => setPushNotifications((value) => !value)} />
            </div>

            <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-surface-2 text-brand-accent">
                  <CalendarDays className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                  <p className="font-medium text-brand-text">Resumen semanal</p>
                  <p className="text-xs text-brand-muted">Reporte breve de tu actividad</p>
                </div>
              </div>
              <Switch enabled={weeklySummary} onToggle={() => setWeeklySummary((value) => !value)} />
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Sesiones activas">
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-4 rounded-xl border border-white/10 px-4 py-3">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-surface-2 text-brand-accent">
                  <Laptop className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                  <p className="font-medium text-brand-text">Chrome · Windows · Lima, Perú</p>
                  <p className="text-xs text-brand-muted">Sesión actual</p>
                </div>
              </div>
              <button type="button" className="text-sm font-medium text-brand-negative transition-colors duration-150 hover:opacity-80">
                Cerrar sesión
              </button>
            </div>

            <div className="flex items-start justify-between gap-4 rounded-xl border border-white/10 px-4 py-3">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-surface-2 text-brand-accent">
                  <Smartphone className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                  <p className="font-medium text-brand-text">App móvil · iOS · Lima, Perú</p>
                  <p className="text-xs text-brand-muted">Activa hace 2 días</p>
                </div>
              </div>
              <button type="button" className="text-sm font-medium text-brand-negative transition-colors duration-150 hover:opacity-80">
                Cerrar sesión
              </button>
            </div>
          </div>
        </SectionCard>
      </div>
    </section>
  )
}
