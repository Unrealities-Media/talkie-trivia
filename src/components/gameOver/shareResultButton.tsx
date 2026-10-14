import React, { useState } from "react"
import { View, Alert, ViewStyle } from "react-native"
import { PlayerGame } from "../../models/game"
import { shareGameResult } from "../../utils/shareUtils"
import { Button } from "../ui/button"
import { useStyles, Theme } from "../../utils/hooks/useStyles"
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
  const [isSharing, setIsSharing] = useState(false)

  const handleShare = async () => {
    if (isSharing) return
    setIsSharing(true)
    try {
      await shareGameResult(playerGame)
    } catch (error) {
      console.error("Error during sharing process:", error)
      Alert.alert(
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
