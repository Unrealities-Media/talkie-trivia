import React, { useRef, useEffect, useCallback } from "react"
import ConfettiCannon from "react-native-confetti-cannon"
import { usePremiereMotion } from "../utils/hooks/usePremiereMotion"

const confettiColors = ["#FF7868", "#F8E7CA", "#AF9B84"]

interface ConfettiCelebrationProps {
  startConfetti: boolean
  onConfettiStop?: () => void
}
const ConfettiCelebration: React.FC<ConfettiCelebrationProps> = ({
  startConfetti,
  onConfettiStop,
}) => {
  const reduced = usePremiereMotion()
  const confettiRef = useRef<any>(null)

  const start = useCallback(() => confettiRef.current?.start(), [])
  const stop = useCallback(() => onConfettiStop?.(), [onConfettiStop])

  useEffect(() => {
    if (!startConfetti) return
    if (reduced) stop()
    else start()
  }, [startConfetti, reduced, start, stop])

  return startConfetti && !reduced ? (
    <ConfettiCannon
      testID="confetti-cannon"
      count={80}
      autoStart={false}
      origin={{ x: -100, y: 0 }}
      colors={confettiColors}
      fallSpeed={2000}
      fadeOut={true}
      explosionSpeed={500}
      ref={confettiRef}
      onAnimationEnd={stop}
    />
  ) : null
}

export default ConfettiCelebration
