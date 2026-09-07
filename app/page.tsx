"use client"

import { AuthProvider, useAuth } from "@/components/auth-provider"
import { LoginScreen } from "@/components/login-screen"
import { DashboardView } from "@/components/dashboard-view"

// Enrutador de la SPA: decide qué pantalla renderizar según el estado de sesión.
function AppRouter() {
  const { isAuthenticated } = useAuth()
  return isAuthenticated ? <DashboardView /> : <LoginScreen />
}

export default function Page() {
  return (
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  )
}
