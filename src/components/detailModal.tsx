import React, { ReactNode, useState } from "react"
import {
  Modal,
  Pressable,
  View,
  Alert,
  ViewStyle,
  StyleSheet,
} from "react-native"
import { PlayerGame } from "../models/game"
import { shareGameResult } from "../utils/shareUtils"
import { savedScore } from "../utils/resultSummary"
import { hapticsService } from "../utils/hapticsService"
import { useStyles, Theme } from "../utils/hooks/useStyles"
import { Button } from "./ui/button"

interface DetailModalProps {
  playerGame?: PlayerGame | null
  show: boolean
  toggleModal: (show: boolean) => void
  children: ReactNode
}

const DetailModal: React.FC<DetailModalProps> = ({
  playerGame,
  show,
  toggleModal,
  children,
}) => {
  const styles = useStyles(themedStyles)
  const [isSharing, setIsSharing] = useState(false)

  const handleShare = async () => {
    if (!playerGame || isSharing) return
    setIsSharing(true)
    try {
      await shareGameResult(playerGame)
    } catch {
      Alert.alert("Sharing Failed", "Your result could not be shared. Please try again.")
    } finally {
      setIsSharing(false)
    }
  }

  const handleClose = () => {
    hapticsService.light()
    toggleModal(false)
  }

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={show}
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <View style={styles.centeredView}>
        {/* Backdrop Tap Layer */}
        <Pressable
          style={styles.backdrop}
          onPress={handleClose}
          accessible={true}
          accessibilityLabel="Close modal by tapping outside"
        />

        {/* Modal Content Card */}
        <View style={styles.modalView}>
          <View style={styles.contentContainer}>{children}</View>

          <View style={styles.buttonContainer}>
            <Button
              title="Close"
              variant="secondary"
              onPress={handleClose}
              style={styles.button}
            />
            {playerGame && savedScore(playerGame) !== null && (
              <Button
                title="Share"
                variant="primary"
                onPress={handleShare}
                isLoading={isSharing}
                style={styles.button}
              />
            )}
          </View>
        </View>
      </View>
    </Modal>
  )
}

interface ModalStyles {
  centeredView: ViewStyle
  backdrop: ViewStyle
  modalView: ViewStyle
  contentContainer: ViewStyle
  buttonContainer: ViewStyle
  button: ViewStyle
}

const themedStyles = (theme: Theme): ModalStyles => ({
  centeredView: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
  },
  modalView: {
    width: "90%",
    maxHeight: "85%",
    maxWidth: theme.responsive.scale(500),
    backgroundColor: theme.colors.surface,
    borderRadius: theme.responsive.scale(15),
    padding: theme.spacing.large,
    ...theme.shadows.medium,
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
  },
  contentContainer: {
    flexShrink: 1,
    width: "100%",
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-evenly",
    width: "100%",
    marginTop: theme.spacing.medium,
    flexGrow: 0,
    flexShrink: 0,
  },
  button: {
    flex: 1,
    marginHorizontal: theme.spacing.small,
  },
})

export default DetailModal
