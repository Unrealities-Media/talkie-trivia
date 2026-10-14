import React from "react"
import { View, ViewStyle, TextStyle } from "react-native"
import { FontAwesome } from "@expo/vector-icons"
import { useStyles, Theme } from "../utils/hooks/useStyles"
import { Card } from "./ui/card"
import { Typography } from "./ui/typography"

interface ProfileSectionProps {
  title: string
  icon: keyof typeof FontAwesome.glyphMap
  children: React.ReactNode
}

const ProfileSection: React.FC<ProfileSectionProps> = ({
  title,
  icon,
  children,
}) => {
  const styles = useStyles(themedStyles)

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <FontAwesome
          name={icon}
          size={styles.icon.fontSize}
          color={styles.icon.color}
        />
        <Typography accessibilityRole="header" variant="h2" style={styles.title}>
          {title}
        </Typography>
      </View>
      <View style={styles.content}>{children}</View>
    </Card>
  )
}

interface ProfileSectionStyles {
  card: ViewStyle
  header: ViewStyle
  icon: TextStyle
  title: TextStyle
  content: ViewStyle
}

const themedStyles = (theme: Theme): ProfileSectionStyles => ({
  card: {
    width: "100%",
    maxWidth: theme.responsive.scale(500),
    marginBottom: theme.spacing.large,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowOpacity: 0,
    elevation: 0,
    overflow: "hidden", // Ensures children conform to border radius
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: theme.spacing.medium,
    backgroundColor: "transparent",
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  icon: {
    fontSize: theme.responsive.responsiveFontSize(16),
    color: theme.colors.accentText,
  },
  title: {
    fontFamily: "PremiereDisplay",
    fontSize: 28,
    lineHeight: 36,
    color: theme.colors.textPrimary,
    marginLeft: theme.spacing.small,
  },
  content: {
    padding: theme.spacing.medium,
  },
})

export default ProfileSection
