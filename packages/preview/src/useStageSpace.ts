import { useEffect, useState, type RefObject } from 'react'

export type StageSpace = { width: number | null; height: number | null }

/**
 * 미리보기 무대에 남은 자리. 폭은 늘 재고, 높이는 `measureHeight` 일 때만 잰다 —
 * 그때만 무대 높이가 「남은 높이」다(정해진 높이 칸). 아니면 무대 높이가 곧 기기 높이라 재면 배율이 제자리에 묶인다.
 * 접힌 칸(크기 0)은 0 으로 알려진다 — 칸이 보이면 다시 재서 맞춘다
 */
export function useStageSpace(
  ref: RefObject<HTMLElement | null>,
  measureHeight: boolean,
): StageSpace {
  const [space, setSpace] = useState<StageSpace>({ width: null, height: null })
  useEffect(() => {
    const stage = ref.current
    if (!stage || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setSpace({ width, height: measureHeight && height > 0 ? height : null })
    })
    observer.observe(stage)
    return () => observer.disconnect()
  }, [ref, measureHeight])
  return space
}
