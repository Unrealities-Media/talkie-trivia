import { Dimensions, PixelRatio, Platform } from "react-native"
import { lightColors, ThemeColors } from "./themes"

const baseWidth = 375
const baseHeight = 812

const windowSize = () => {
  const { width, height } = Dimensions.get("window")
  return {
    width: Number.isFinite(width) && width > 0 ? width : baseWidth,
    height: Number.isFinite(height) && height > 0 ? height : baseHeight,
  }
}
const isSmallScreen = () => windowSize().width < 375
const isMediumScreen = () => windowSize().width >= 375 && windowSize().width < 768
const isLargeScreen = () => windowSize().width >= 768

const scale = (size: number) => {
  const { width, height } = windowSize()
  const scaleWidth = width / baseWidth
  const scaleHeight = height / baseHeight
  const scaleFactor = Math.min(scaleWidth, scaleHeight)
  return PixelRatio.roundToNearestPixel(size * scaleFactor)
}

const responsiveFontSize = (size: number) => {
  let scaleFactor: number

  if (isSmallScreen()) {
    scaleFactor = (windowSize().width / baseWidth) * 0.9
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
  get isSmallDevice() { return windowSize().width < 375 },
  get isTablet() { return windowSize().width >= 768 },
  get screenWidth() { return windowSize().width },
  get screenHeight() { return windowSize().height },
  platform: Platform.OS,
  isSmallScreen,
  isMediumScreen,
  isLargeScreen,
}

export const getTypography = (colors: typeof lightColors) => ({
  heading1: {
    fontFamily: "PremiereDisplay",
    fontSize: responsive.responsiveFontSize(28),
    lineHeight: responsive.responsiveFontSize(34),
    color: colors.textPrimary,
  },
  heading2: {
    fontFamily: "PremiereDisplay",
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
  get extraSmall() { return scale(4) },
  get small() { return scale(8) },
  get medium() { return scale(16) },
  get large() { return scale(24) },
  get extraLarge() { return scale(32) },
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

export const getButtonStyles = (_colors: ThemeColors) => ({
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
