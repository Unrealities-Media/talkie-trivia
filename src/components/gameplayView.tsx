import React, { useState, useCallback } from "react"
import { View, ViewStyle, StyleProp } from "react-native"
import PickerContainer from "./picker"
import SeatHints from "./seatHints"
import ConfirmationModal from "./confirmationModal"
import { hapticsService } from "../utils/hapticsService"
import { useGameStore } from "../state/gameStore"
import { useShallow } from "zustand/react/shallow"
import { Button } from "./ui/button"
import { useStyles, Theme } from "../utils/hooks/useStyles"
import { u } from "../styles/utils"
import { GAME_MODE_CONFIG } from "../config/difficulty"
import { Typography } from "./ui/typography"

const GameplayView: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
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
  // Keep the original error in the store; the transport status is not an instruction for the player.
  const saveErrorText = syncError?.replace(/\s+\[[45]\d{2}\]\s*$/, "")
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
    <View style={{ width: "100%", paddingHorizontal: 20 }}>
      {syncStatus === "saving" && <View style={styles.saveStatus}>
        <Typography accessibilityLiveRegion="polite" style={{ textAlign: "center" }}>Saving your move…</Typography>
      </View>}
      {syncStatus === "pending" && <View accessibilityLiveRegion="polite" style={styles.saveStatus}>
        <Typography accessibilityRole="header" variant="h2" style={{ fontFamily: "PremiereDisplay", fontSize: 28, lineHeight: 34, textAlign: "center" }}>Waiting to save</Typography>
        <Typography style={{ textAlign: "center" }}>{saveErrorText || "Your move is waiting to be saved."}</Typography>
        <Button title="Retry save" onPress={() => { void retryPendingAction() }} />
      </View>}
      <SeatHints />
      <PickerContainer />
      {children}

      <Button
        title="Give Up?"
        size="sm"
        onPress={handleGiveUpPress}
        isLoading={isGivingUp}
        disabled={isInteractionsDisabled || syncStatus !== "idle"}
        variant="secondary"
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
    </View>
  )
}

interface GameplayViewStyles {
  giveUpButton: ViewStyle
  saveStatus: ViewStyle
}

const themedStyles = (theme: Theme): GameplayViewStyles => ({
  saveStatus: {
    width: "100%",
    gap: 12,
    padding: 16,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 3,
    backgroundColor: theme.colors.surface,
  },
  giveUpButton: {
    backgroundColor: "transparent",
    borderWidth: 0,
    alignSelf: "center",
  },
})

export default GameplayView
