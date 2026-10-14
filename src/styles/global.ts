import { Dimensions, PixelRatio, Platform } from "react-native"
import { lightColors, ThemeColors } from "./themes"

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window")

const baseWidth = 375
const baseHeight = 812

const isSmallScreen = () => SCREEN_WIDTH < 375
const isMediumScreen = () => SCREEN_WIDTH >= 375 && SCREEN_WIDTH < 768
const isLargeScreen = () => SCREEN_WIDTH >= 768

const scale = (size: number) => {
  const scaleWidth = SCREEN_WIDTH / baseWidth
  const scaleHeight = SCREEN_HEIGHT / baseHeight
  const scaleFactor = Math.min(scaleWidth, scaleHeight)
  return PixelRatio.roundToNearestPixel(size * scaleFactor)
}

const responsiveFontSize = (size: number) => {
  let scaleFactor = 1

  if (isSmallScreen()) {
    scaleFactor = (SCREEN_WIDTH / baseWidth) * 0.9
  } else if (isMediumScreen()) {
    scaleFactor = 1.0
  } else {
    scaleFactor = 1.1
  }

  return Math.min(
    PixelRatio.roundToNearestPixel(size * scaleFactor),
    size * 1.2
  )
}

export const responsive = {
  scale,
  responsiveFontSize,
  isSmallDevice: SCREEN_WIDTH < 375,
  isTablet: SCREEN_WIDTH >= 768,
  screenWidth: SCREEN_WIDTH,
  screenHeight: SCREEN_HEIGHT,
  platform: Platform.OS,
  isSmallScreen,
  isMediumScreen,
  isLargeScreen,
}

export const getTypography = (colors: typeof lightColors) => ({
  heading1: {
    fontFamily: "PremiereDisplay-Bold",
    fontSize: responsive.responsiveFontSize(28),
    lineHeight: responsive.responsiveFontSize(34),
    color: colors.textPrimary,
  },
  heading2: {
    fontFamily: "PremiereSerif",
    fontSize: responsive.responsiveFontSize(22),
    lineHeight: responsive.responsiveFontSize(28),
    color: colors.textPrimary,
  },
  bodyText: {
    fontFamily: "PremiereSans",
    fontSize: responsive.responsiveFontSize(16),
    lineHeight: responsive.responsiveFontSize(22),
    color: colors.textSecondary,
  },
  button: {
    fontFamily: "PremiereSans",
    fontSize: responsive.responsiveFontSize(16),
    color: colors.onAccent,
  },
  caption: {
    fontFamily: "PremiereSans",
    fontSize: responsive.responsiveFontSize(12),
    lineHeight: responsive.responsiveFontSize(16),
    color: colors.textSecondary,
  },
})

export const spacing = {
  extraSmall: scale(4),
  small: scale(8),
  medium: scale(16),
  large: scale(24),
  extraLarge: scale(32),
}

export const shadows = {
  light: Platform.select({
    ios: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.23,
      shadowRadius: 2.62,
    },
    android: { elevation: 4 },
    web: { boxShadow: "0 2px 4px rgba(0,0,0,0.1)" },
  }),
  medium: Platform.select({
    ios: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 4.65,
    },
    android: { elevation: 8 },
    web: { boxShadow: "0 4px 8px rgba(0,0,0,0.15)" },
  }),
}

export const getButtonStyles = (colors: ThemeColors) => ({
  base: {
    minHeight: 48,
    minWidth: 48,
    borderRadius: responsive.scale(8),
    paddingVertical: spacing.small,
    paddingHorizontal: spacing.medium,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    ...shadows.light,
  },
  text: {
    fontFamily: "PremiereSans",
    fontSize: responsive.responsiveFontSize(16),
    textAlign: "center" as const,
  },
  pressed: {
    transform: [{ translateY: 2 }],
  },
  disabled: {
    opacity: 0.6,
  },
})
