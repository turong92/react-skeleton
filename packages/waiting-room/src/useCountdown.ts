import { useEffect, useState } from 'react'

/** `1:02:03` 꼴 - 시간이 24 를 넘어도 그대로 시간으로 센다 */
export function formatClock(milliseconds: number): string {
  const total = Math.max(0, Math.ceil(milliseconds / 1000))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

/** 목표 시각까지 남은 시간을 1초마다 `1:02:03` 으로. 서버 렌더에는 시계가 없어 null(서버와 브라우저의 글이 어긋나지 않게) */
export function useCountdown(targetIso: string): string | null {
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    const tick = () => setNow(Date.now())
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])
  return now === null ? null : formatClock(new Date(targetIso).getTime() - now)
}
