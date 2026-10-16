import React, { useState, useCallback, useRef, useEffect } from "react"
import { View, ViewStyle, StyleProp, Platform, GestureResponderEvent } from "react-native"
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
  const root = useRef<View>(null)
  const saveStatus = useRef<HTMLDivElement>(null)

  const retrySave = (event: GestureResponderEvent) => {
    // The retry button disappears during saving. Keep keyboard position on a
    // stable status node; pointer activation does not request a focus change.
    if (Platform.OS === "web" && (event.nativeEvent as unknown as MouseEvent)?.detail === 0) {
      saveStatus.current?.focus()
    }
    void retryPendingAction()
  }
  useEffect(() => {
    if (Platform.OS === "web" && syncStatus === "idle" && document.activeElement === saveStatus.current) {
      // Resume guessing only if the player has not moved elsewhere meanwhile.
      const node = root.current as unknown as HTMLElement | null
      node?.querySelector<HTMLInputElement>('input[role="searchbox"]:not(:disabled)')?.focus()
    }
  }, [syncStatus])

  const saveMessage = syncStatus === "saving"
    ? <Typography style={{ textAlign: "center" }}>Saving your move…</Typography>
    : syncStatus === "pending" ? <>
      <Typography accessibilityRole="header" variant="h2" style={{ fontFamily: "PremiereDisplay", fontSize: 28, lineHeight: 34, textAlign: "center" }}>Waiting to save</Typography>
      <Typography style={{ textAlign: "center" }}>{saveErrorText || "Your move is waiting to be saved."}</Typography>
    </> : null

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
    <View ref={root} style={{ width: "100%", paddingHorizontal: 20 }}>
      <View style={syncStatus !== "idle" ? styles.saveStatus : undefined}>
        {Platform.OS === "web"
          ? <div ref={saveStatus} role="status" aria-live="polite" aria-atomic="true" tabIndex={-1} style={{ display: "flex", flexDirection: "column", gap: 12 }}>{saveMessage}</div>
          : <View accessibilityLiveRegion="polite" style={{ gap: 12 }}>{saveMessage}</View>}
        {syncStatus === "pending" && <Button title="Retry save" onPress={retrySave} />}
      </View>
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
