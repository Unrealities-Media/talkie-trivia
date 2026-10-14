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
        <Typography variant="h2" style={styles.title}>
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
    overflow: "hidden", // Ensures children conform to border radius
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: theme.spacing.medium,
    backgroundColor:
      theme.colorScheme === "dark"
        ? "rgba(255,255,255,0.05)"
        : "rgba(0,0,0,0.02)",
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  icon: {
    fontSize: theme.responsive.responsiveFontSize(16),
    color: theme.colors.accentText,
  },
  title: {
    fontSize: theme.responsive.responsiveFontSize(18),
    color: theme.colors.accentText,
    marginLeft: theme.spacing.small,
  },
  content: {
    padding: theme.spacing.medium,
  },
})

export default ProfileSection
