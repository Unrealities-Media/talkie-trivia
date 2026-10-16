import React, { useState, useEffect } from "react"
import { View, Alert, ViewStyle, Text, TextInput, Platform } from "react-native"
import { PlayerGame } from "../../models/game"
import { shareGameResult, generateShareMessage } from "../../utils/shareUtils"
import { Button } from "../ui/button"
import { useStyles, Theme, useThemeTokens } from "../../utils/hooks/useStyles"
import { u } from "../../styles/utils"
import { savedScore } from "../../utils/resultSummary"
import Svg, { Path } from "react-native-svg"

interface ShareResultButtonProps {
  playerGame: PlayerGame
}

const ShareResultButton: React.FC<ShareResultButtonProps> = ({
  playerGame,
}) => {
  const styles = useStyles(themedStyles)
  const { colors } = useThemeTokens()
  const [isSharing, setIsSharing] = useState(false)
  const [status, setStatus] = useState("")
  const [copyText, setCopyText] = useState("")
  useEffect(() => { setStatus(""); setCopyText("") }, [playerGame.id])

  const handleShare = async () => {
    if (isSharing) return
    setIsSharing(true)
    setStatus("")
    setCopyText("")
    try {
      const copyResult = async () => {
        const text = generateShareMessage(playerGame)
        try {
          await navigator.clipboard.writeText(text)
          setStatus("Result copied. Share it with a fellow movie lover.")
        } catch {
          setCopyText(text)
          setStatus("Select and copy your result below.")
        }
      }
      if (Platform.OS === "web") {
        if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
          try {
            // The utility handles dismissal without throwing. Only a failed
            // share sheet should fall back to copying the result.
            await shareGameResult(playerGame)
          } catch {
            await copyResult()
          }
        } else await copyResult()
      } else await shareGameResult(playerGame)
    } catch (error) {
      console.error("Error during sharing process:", error)
      setStatus("Could not share your result. Please try again.")
      if (Platform.OS !== "web") Alert.alert(
        "Sharing Failed",
        "An error occurred while trying to share your results."
      )
    } finally {
      setIsSharing(false)
    }
  }

  return (
    <View style={[u.wFull, u.alignCenter, styles.container]}>
      <Button
        title="Share Your Result"
        leadingIcon={<Svg width={23} height={25} viewBox="0 0 24 26" fill="none" stroke="#061923" strokeWidth={1.7} aria-hidden={true}><Path d="M12 17V2M7 7l5-5 5 5M7 11H4v13h16V11h-3" /></Svg>}
        onPress={handleShare}
        isLoading={isSharing}
        disabled={savedScore(playerGame) === null}
        variant="primary"
        style={styles.button}
      />
      {!!status && <Text accessibilityLiveRegion="polite" style={{ fontFamily: "PremiereSans", color: colors.textPrimary, fontSize: 13, lineHeight: 20, marginTop: 10, textAlign: "center" }}>{status}</Text>}
      {!!copyText && <TextInput accessibilityLabel="Your result to copy" value={copyText}
        editable={false} multiline numberOfLines={6} selectTextOnFocus
        onFocus={event => {
          // Some browsers focus a field inside a modal without revealing all
          // of it above the fixed Close footer.
          if (Platform.OS === "web") (event.currentTarget as unknown as HTMLElement).scrollIntoView({ block: "nearest" })
        }}
        style={{ fontFamily: "PremiereSans", color: colors.textPrimary, backgroundColor: colors.surface,
          fontSize: 14, lineHeight: 22, marginTop: 12, padding: 12, width: "100%",
          borderWidth: 1, borderColor: colors.border, borderRadius: 4 }} />}
    </View>
  )
}

interface ShareButtonStyles {
  container: ViewStyle
  button: ViewStyle
}

const themedStyles = (theme: Theme): ShareButtonStyles => ({
  container: {
    paddingVertical: theme.spacing.medium,
  },
  button: {
    width: "100%",
    maxWidth: 320,
    borderRadius: 10,
  },
})

export default ShareResultButton
