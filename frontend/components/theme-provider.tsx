"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { useAuth } from "@/components/auth-provider"

type Theme = "light" | "dark"

type ThemeContextValue = {
  theme: Theme
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)
const THEME_STORAGE_KEY = "peya_theme"

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth()
  const [theme, setTheme] = useState<Theme>("dark")

  useEffect(() => {
    const storedTheme = localStorage.getItem(THEME_STORAGE_KEY)
    if (storedTheme === "light" || storedTheme === "dark") {
      setTheme(storedTheme)
    }
  }, [])

  useEffect(() => {
    const activeTheme = isAuthenticated ? theme : "light"
    const root = document.documentElement
    root.classList.toggle("dark", activeTheme === "dark")
    root.classList.toggle("light", activeTheme === "light")
    root.style.colorScheme = activeTheme
  }, [isAuthenticated, theme])

  const toggleTheme = useCallback(() => {
    const nextTheme = theme === "dark" ? "light" : "dark"
    setTheme(nextTheme)
    localStorage.setItem(THEME_STORAGE_KEY, nextTheme)
  }, [theme])

  const value = useMemo(() => ({ theme, toggleTheme }), [theme, toggleTheme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error("useTheme debe usarse dentro de <ThemeProvider>")
  return context
}
