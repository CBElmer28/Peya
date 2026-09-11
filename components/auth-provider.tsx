"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { login as loginRequest, type Session } from "@/lib/mock-api"

type AuthContextValue = {
  session: Session | null
  isAuthenticated: boolean
  signIn: (email: string, password: string, rememberMe?: boolean) => Promise<void>
  setSession: (session: Session | null) => void
  signOut: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)
const STORAGE_KEY = "bankhub_session"

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSessionState] = useState<Session | null>(null)

  // Carga inicial y recuperación de sesión desde almacenamiento local
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) || sessionStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as Session
        if (parsed?.token && parsed?.user) {
          setSessionState(parsed)
        }
      }
    } catch {
      // Ignorar fallos de parsing de sesión corrupta
    }
  }, [])

  const setSession = useCallback((newSession: Session | null) => {
    setSessionState(newSession)
    if (newSession) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newSession))
      } catch {}
    } else {
      try {
        localStorage.removeItem(STORAGE_KEY)
        sessionStorage.removeItem(STORAGE_KEY)
      } catch {}
    }
  }, [])

  const signIn = useCallback(async (email: string, password: string, rememberMe = true) => {
    // Llama al auth-service simulado; lanza Error("401") si las credenciales fallan.
    const result = await loginRequest(email, password)
    setSessionState(result)
    try {
      if (rememberMe) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(result))
      } else {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(result))
      }
    } catch {}
  }, [])

  const signOut = useCallback(() => {
    // Invalida el token y elimina la sesión
    setSessionState(null)
    try {
      localStorage.removeItem(STORAGE_KEY)
      sessionStorage.removeItem(STORAGE_KEY)
    } catch {}
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ session, isAuthenticated: session !== null, signIn, setSession, signOut }),
    [session, signIn, setSession, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>")
  return ctx
}
