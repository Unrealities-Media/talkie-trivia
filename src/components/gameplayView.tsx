import React, { useState, useCallback } from "react"
import { View, ViewStyle, StyleProp } from "react-native"
import PickerContainer from "./picker"
import HintContainer from "./hint"
import ConfirmationModal from "./confirmationModal"
import { hapticsService } from "../utils/hapticsService"
import { useGameStore } from "../state/gameStore"
import { useShallow } from "zustand/react/shallow"
import { Button } from "./ui/button"
import { useStyles, Theme } from "../utils/hooks/useStyles"
import { u } from "../styles/utils"
import { GAME_MODE_CONFIG } from "../config/difficulty"
import { Typography } from "./ui/typography"

const GameplayView: React.FC = () => {
  const { giveUp, isInteractionsDisabled, gameMode } = useGameStore(
    useShallow((state) => ({
      giveUp: state.giveUp,
      isInteractionsDisabled: state.isInteractionsDisabled,
      gameMode: state.gameMode,
    }))
  )
  const styles = useStyles(themedStyles)
  const syncStatus = useGameStore(state => state.syncStatus)
  const syncError = useGameStore(state => state.syncError)
  const retryPendingAction = useGameStore(state => state.retryPendingAction)

  const [showGiveUpConfirmation, setShowGiveUpConfirmation] = useState(false)
  const [isGivingUp, setIsGivingUp] = useState(false)

  const handleGiveUpPress = useCallback(() => {
    hapticsService.warning()
    setShowGiveUpConfirmation(true)
  }, [])

  const cancelGiveUp = useCallback(() => setShowGiveUpConfirmation(false), [])

  const confirmGiveUp = useCallback(() => {
    setShowGiveUpConfirmation(false)
    setIsGivingUp(true)
    void giveUp().finally(() => setIsGivingUp(false))
  }, [giveUp])

  return (
    <>
      {syncStatus === "saving" && <Typography accessibilityLiveRegion="polite">Saving your move…</Typography>}
      {syncStatus === "pending" && <View accessibilityLiveRegion="polite">
        <Typography>{syncError || "Your move is waiting to be saved."}</Typography>
        <Button title="Retry save" onPress={() => { void retryPendingAction() }} />
      </View>}
      <HintContainer />
      <PickerContainer />

      <Button
        title="Give Up?"
        onPress={handleGiveUpPress}
        isLoading={isGivingUp}
        disabled={isInteractionsDisabled || syncStatus !== "idle"}
        variant="error"
        style={[u.wFull, styles.giveUpButton] as StyleProp<ViewStyle>}
        testID="give-up-button"
      />

      <ConfirmationModal
        isVisible={showGiveUpConfirmation}
        title="Give Up?"
        message={GAME_MODE_CONFIG[gameMode].giveUpConfirmation}
        confirmText="Give Up"
        cancelText="Cancel"
        onConfirm={confirmGiveUp}
        onCancel={cancelGiveUp}
      />
    </>
  )
}

interface GameplayViewStyles {
  giveUpButton: ViewStyle
}

const themedStyles = (theme: Theme): GameplayViewStyles => ({
  giveUpButton: {
    backgroundColor: theme.colors.error,
  },
})

export default GameplayView
