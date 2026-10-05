"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { loginApi, logoutApi } from "@/lib/api-client"
import type { Session } from "@/lib/mock-api"

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
    try {
      if (newSession) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newSession))
        sessionStorage.removeItem(STORAGE_KEY)
      } else {
        localStorage.removeItem(STORAGE_KEY)
        sessionStorage.removeItem(STORAGE_KEY)
      }
    } catch {}
  }, [])

  const signIn = useCallback(async (email: string, password: string, rememberMe = true) => {
    const result = await loginApi(email, password, rememberMe)
    const sessionData: Session = {
      token: result.accessToken,
      user: {
        name: result.user.name,
        email: result.user.email,
      },
    }

    setSessionState(sessionData)

    try {
      if (rememberMe) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionData))
        sessionStorage.removeItem(STORAGE_KEY)
      } else {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(sessionData))
        localStorage.removeItem(STORAGE_KEY)
      }
    } catch {}
  }, [setSession])

  const signOut = useCallback(() => {
    void (async () => {
      try {
        if (session?.token) {
          await logoutApi(session.token)
        }
      } catch {}
      setSession(null)
    })()
  }, [session?.token, setSession])

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
