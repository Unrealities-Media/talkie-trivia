import { useEffect, useState } from "react"
import { usePremiereMotion } from "./usePremiereMotion"

/** Counts from zero to a saved value; shows the value at once when motion is reduced. */
export function useCountUp(target: number, { delay = 0, duration = 1000 } = {}) {
  const reduced = usePremiereMotion()
  const [value, setValue] = useState(reduced ? target : 0)
  useEffect(() => {
    if (reduced || target <= 0) {
      setValue(target)
      return
    }
    setValue(0)
    let frame: ReturnType<typeof setTimeout> | undefined
    const start = Date.now() + delay
    const tick = () => {
      const progress = Math.min(1, Math.max(0, (Date.now() - start) / duration))
      setValue(Math.round(target * (1 - Math.pow(1 - progress, 3))))
      if (progress < 1) frame = setTimeout(tick, 16)
    }
    frame = setTimeout(tick, delay)
    return () => clearTimeout(frame)
  }, [target, delay, duration, reduced])
  return value
}
