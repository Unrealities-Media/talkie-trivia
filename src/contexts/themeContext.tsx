import React, {
  createContext,
  useState,
  useEffect,
  useContext,
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
  colors: ThemeColors
  colorScheme: AppColorScheme
}

const THEME_STORAGE_KEY = ASYNC_STORAGE_KEYS.THEME_PREFERENCE

export const ThemeContext = createContext<ThemeContextType | undefined>(
  undefined
)

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const systemColorScheme = useRNColorScheme() ?? "light"
  const [theme, setThemeState] = useState<Theme>("system")

  const colorScheme: AppColorScheme =
    theme === "system" ? (systemColorScheme as AppColorScheme) : theme

  useEffect(() => {
    const loadTheme = async () => {
      try {
        const storedTheme = (await AsyncStorage.getItem(
          THEME_STORAGE_KEY
        )) as Theme | null
        if (storedTheme) {
          setThemeState(storedTheme)
        }
      } catch (e) {
        console.error("Failed to load theme from storage", e)
      }
    }
    loadTheme()
  }, [])

  const setTheme = async (newTheme: Theme) => {
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, newTheme)
      setThemeState(newTheme)

      if (Platform.OS !== "web") {
        if (newTheme === "system") {
          Appearance.setColorScheme("unspecified")
        } else {
          Appearance.setColorScheme(newTheme)
        }
      }
    } catch (e) {
      console.error("Failed to save theme to storage", e)
    }
  }

  const colors: ThemeColors = colorScheme === "dark" ? darkColors : lightColors

  return (
    <ThemeContext.Provider value={{ theme, setTheme, colors, colorScheme }}>
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
