import React, { memo, useEffect, useRef } from "react"
import { Modal, View, ViewStyle, TextStyle, Platform } from "react-native"
import { hapticsService } from "../utils/hapticsService"
import { useStyles, Theme } from "../utils/hooks/useStyles"
import { Button } from "./ui/button"
import { Typography } from "./ui/typography"
import { usePremiereMotion } from "../utils/hooks/usePremiereMotion"

interface ConfirmationModalProps {
  isVisible: boolean
  title: string
  message: string
  confirmText: string
  cancelText: string
  onConfirm: () => void
  onCancel: () => void
}

const ConfirmationModal = memo(
  ({
    isVisible,
    title,
    message,
    confirmText,
    cancelText,
    onConfirm,
    onCancel,
  }: ConfirmationModalProps) => {
    const styles = useStyles(themedStyles)
    const reduced = usePremiereMotion()
    const dialogRef = useRef<View>(null)
    useEffect(() => {
      if (!isVisible || Platform.OS !== "web" || typeof document === "undefined") return
      const previous = document.activeElement as HTMLElement | null
      const buttons = () => Array.from((dialogRef.current as unknown as HTMLElement | null)?.querySelectorAll<HTMLElement>('[role="button"]:not([aria-disabled="true"]), button:not([disabled])') ?? [])
      const timer = setTimeout(() => {
        const dialog = dialogRef.current as unknown as HTMLElement | null
        // The web Modal may already have focused a control. Do not undo a
        // keyboard move made before this deferred initialization runs.
        if (dialog && !dialog.contains(document.activeElement)) buttons()[0]?.focus()
      }, 0)
      const containFocus = (event: FocusEvent) => {
        const dialog = dialogRef.current as unknown as HTMLElement | null
        if (dialog && !dialog.contains(event.target as Node)) buttons()[0]?.focus()
      }
      const onKey = (event: KeyboardEvent) => {
        if (event.key === "Tab") {
          const items = buttons()
          const first = items[0], last = items[items.length - 1]
          if ((event.shiftKey && document.activeElement === first) || (!event.shiftKey && document.activeElement === last)) {
            event.preventDefault()
            ;(event.shiftKey ? last : first)?.focus()
          }
        }
      }
      document.addEventListener("focusin", containFocus)
      document.addEventListener("keydown", onKey)
      return () => {
        clearTimeout(timer)
        document.removeEventListener("focusin", containFocus)
        document.removeEventListener("keydown", onKey)
        previous?.focus()
      }
    }, [isVisible])

    const handleConfirm = () => {
      hapticsService.heavy()
      onConfirm()
    }
    const handleCancel = () => {
      hapticsService.light()
      onCancel()
    }

    return (
      <Modal
        animationType={reduced ? "none" : "fade"}
        transparent={true}
        visible={isVisible}
        onRequestClose={handleCancel}
      >
        {isVisible && (
          <View
            style={styles.centeredView}
            testID="confirmation-modal-container"
          >
            <View ref={dialogRef} style={styles.modalView} accessibilityViewIsModal aria-modal={true}>
              <Typography accessibilityRole="header" variant="h2" style={styles.title}>
                {title}
              </Typography>

              <Typography variant="body" style={styles.message}>
                {message}
              </Typography>

              <View style={styles.buttonContainer}>
                <Button
                  title={cancelText}
                  variant="secondary"
                  onPress={handleCancel}
                  style={styles.button}
                />
                <Button
                  title={confirmText}
                  variant="primary"
                  onPress={handleConfirm}
                  style={styles.button}
                />
              </View>
            </View>
          </View>
        )}
      </Modal>
    )
  }
)

interface ModalStyles {
  centeredView: ViewStyle
  modalView: ViewStyle
  title: TextStyle
  message: TextStyle
  buttonContainer: ViewStyle
  button: ViewStyle
}

const themedStyles = (theme: Theme): ModalStyles => ({
  centeredView: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalView: {
    backgroundColor: theme.colors.background,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: 3,
    padding: 20,
    width: "90%",
    maxWidth: 440,
    ...theme.shadows.medium,
  },
  title: {
    fontFamily: "PremiereDisplay",
    fontSize: 32,
    lineHeight: 38,
    marginBottom: theme.spacing.small,
    textAlign: "center",
  },
  message: {
    marginBottom: theme.spacing.large,
    textAlign: "center",
  },
  buttonContainer: {
    flexDirection: "column",
    gap: 10,
    justifyContent: "space-around",
  },
  button: {
    width: "100%",
  },
})

export default ConfirmationModal
