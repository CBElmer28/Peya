"use client"

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react"
import { loginApi } from "@/lib/api-client"
import { type Session } from "@/lib/mock-api"

type AuthContextValue = {
  session: Session | null
  isAuthenticated: boolean
  signIn: (email: string, password: string) => Promise<void>
  setSession: (session: Session | null) => void
  signOut: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)

  const signIn = useCallback(async (email: string, password: string) => {
    const result = await loginApi(email, password, true)
    setSession({
      token: result.accessToken,
      user: {
        name: result.user.name,
        email: result.user.email,
      },
    })
  }, [])

  const signOut = useCallback(() => {
    // Aquí se invalidaría el token en el auth-service (POST /auth/logout).
    setSession(null)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ session, isAuthenticated: session !== null, signIn, setSession, signOut }),
    [session, signIn, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>")
  return ctx
}
