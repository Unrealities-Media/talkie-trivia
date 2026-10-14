import React, {
  createContext,
  useState,
  useEffect,
  useContext,
  useRef,
  ReactNode,
} from "react"
import {
  useColorScheme as useRNColorScheme,
  Appearance,
  Platform,
} from "react-native"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { lightColors, darkColors } from "../styles/themes"
import { ASYNC_STORAGE_KEYS } from "../config/constants"

export type Theme = "light" | "dark" | "system"
export type AppColorScheme = "light" | "dark"
export type ThemeColors = typeof lightColors

interface ThemeContextType {
  theme: Theme
  setTheme: (theme: Theme) => void
  saveError?: string | null
  colors: ThemeColors
  colorScheme: AppColorScheme
}

const THEME_STORAGE_KEY = ASYNC_STORAGE_KEYS.THEME_PREFERENCE

export const ThemeContext = createContext<ThemeContextType | undefined>(
  undefined
)

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const systemColorScheme = useRNColorScheme() ?? "light"
  const [theme, setThemeState] = useState<Theme>("dark")
  const [saveError, setSaveError] = useState<string | null>(null)
  const preferenceRevision = useRef(0)
  const writeQueue = useRef(Promise.resolve())
  const mounted = useRef(false)

  const colorScheme: AppColorScheme =
    theme === "system"
      ? systemColorScheme === "dark" ? "dark" : "light"
      : theme

  useEffect(() => {
    mounted.current = true
    let cancelled = false
    const revision = preferenceRevision.current
    const loadTheme = async () => {
      try {
        const storedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY)
        if (
          !cancelled &&
          preferenceRevision.current === revision &&
          (storedTheme === "light" || storedTheme === "dark" || storedTheme === "system")
        ) {
          setThemeState(storedTheme)
        }
      } catch (e) {
        if (__DEV__) console.error("Failed to load theme from storage", e)
      }
    }
    loadTheme()
    return () => {
      cancelled = true
      mounted.current = false
    }
  }, [])

  useEffect(() => {
    if (Platform.OS !== "web") {
      Appearance.setColorScheme(theme === "system" ? "unspecified" : theme)
    }
  }, [theme])

  const setTheme = (newTheme: Theme) => {
    const revision = ++preferenceRevision.current
    setThemeState(newTheme)
    setSaveError(null)
    // Preserve tap order on disk even when storage is slow. A failed write must
    // not prevent the next preference from being saved.
    writeQueue.current = writeQueue.current
      .then(() => AsyncStorage.setItem(THEME_STORAGE_KEY, newTheme))
      .catch(() => {
        if (mounted.current && preferenceRevision.current === revision) {
          setSaveError(
            "Theme changed for this session. Tap your choice again to save it."
          )
        }
      })
  }

  const colors: ThemeColors = colorScheme === "dark" ? darkColors : lightColors

  return (
    <ThemeContext.Provider value={{ theme, setTheme, saveError, colors, colorScheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider")
  }
  return context
}
