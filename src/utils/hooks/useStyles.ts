import { useMemo } from "react"
import { StyleSheet, useWindowDimensions } from "react-native"
import { useTheme } from "../../contexts/themeContext"
import {
  spacing,
  getTypography,
  shadows,
  responsive,
} from "../../styles/global"

/**
 * Consolidates all design system tokens into a single object for use in style factories.
 * This is the heart of the themed styling system.
 */
export const useThemeTokens = () => {
  // Subscribe themed components to resize/orientation changes.
  useWindowDimensions()
  const { colors, colorScheme } = useTheme()
  return {
    colors,
    spacing,
    typography: getTypography(colors),
    shadows,
    responsive,
    colorScheme,
  }
}

/**
 * The complete theme object type, containing all design tokens.
 */
export type Theme = ReturnType<typeof useThemeTokens>

/**
 * Type for a function that takes the theme object and returns a StyleSheet.
 */
type StyleFactory<T> = (theme: Theme) => T

/**
 * A custom hook to create themed and memoized stylesheets.
 * This hook replaces the old pattern of `useMemo(() => getStyles(colors), [colors])`
 * and provides the full theme object to the style factory.
 *
 * @param styleFactory A function that receives the full theme object and returns a StyleSheet.
 * @returns A memoized StyleSheet object that updates when the theme changes.
 */
export const useStyles = <T extends StyleSheet.NamedStyles<T>>(
  styleFactory: StyleFactory<T>
): T => {
  const theme = useThemeTokens()

  // useMemo ensures that StyleSheet.create is only called when the theme or factory function changes.
  return useMemo(
    () => StyleSheet.create(styleFactory(theme)),
    [theme, styleFactory]
  )
}
