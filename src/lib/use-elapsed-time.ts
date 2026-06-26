import { useEffect, useState } from 'react'

export function useElapsedNow(isActive: boolean) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!isActive) {
      return
    }

    setNow(Date.now())
    const intervalId = window.setInterval(() => {
      setNow(Date.now())
    }, 1000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [isActive])

  return now
}

export function formatElapsedMessage(
  message: string | null | undefined,
  startedAt: number | null | undefined,
  now: number,
) {
  if (!message) {
    return message ?? null
  }
  if (typeof startedAt !== 'number') {
    return message
  }

  const elapsedSeconds = Math.max(0, Math.floor((now - startedAt) / 1000))
  const elapsedText =
    elapsedSeconds < 60
      ? `${elapsedSeconds} 秒`
      : `${Math.floor(elapsedSeconds / 60)} 分 ${elapsedSeconds % 60} 秒`

  return `${message}（已用时 ${elapsedText}）`
}
