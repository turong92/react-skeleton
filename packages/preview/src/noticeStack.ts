import { useCallback, useEffect, useState } from 'react'

/**
 * 쌓인 안내 알약의 높이(px) — 뷰어가 맞추기 자리를 이만큼 더 비운다. 크기가 바뀌거나 알약이 더해지고 빠질 때마다 다시 잰다(요소가 없으면 0).
 * 값은 entry 가 아니라 요소의 상자에서 읽는다(알약 사이 틈 포함, 접힌 알약은 0).
 * `stamp` 는 잴 때마다 늘어난다 — 알약이 바뀌었는데 높이가 우연히 같아도 「다시 쟀다」를 알 수 있게
 */
export function useNoticeHeight(): {
  ref: (el: HTMLElement | null) => void
  height: number
  stamp: number
} {
  const [element, setElement] = useState<HTMLElement | null>(null)
  const [measured, setMeasured] = useState({ height: 0, stamp: 0 })
  useEffect(() => {
    if (!element || typeof ResizeObserver === 'undefined') return
    const measure = () =>
      setMeasured((before) => ({
        height: element.getBoundingClientRect().height,
        stamp: before.stamp + 1,
      }))
    const resize = new ResizeObserver(measure)
    resize.observe(element)
    const mutation = new MutationObserver(measure)
    mutation.observe(element, { childList: true, subtree: true })
    return () => {
      resize.disconnect()
      mutation.disconnect()
    }
  }, [element])
  const ref = useCallback((el: HTMLElement | null) => setElement(el), [])
  // 요소가 사라지면(접힌 판) 마지막으로 잰 높이를 들고 있지 않는다
  return { ref, height: element ? measured.height : 0, stamp: measured.stamp }
}

/**
 * 칸에서 뺄 자리(px) — 위 여백 12 · 쌓인 안내 높이 [notices] 를 포함한다.
 * 넓은 결: 위 = 안내 줄(최소 알약 한 줄 44), 아래 = 막대 60 + 위아래 여백 둘(24).
 * 좁은 결: 위 = 알약 48 + 쌓인 안내(펴기 판 자리는 `useViewerZoom` 이 더한다), 아래 = 패드 48 + 여백 24 + 안전 영역 짐작.
 * [panelOpen](좁은 결에서 판이 열림)이면 알약 · 패드가 없다 — 위는 판 위 여백 12 + 판과 기기 사이 12 + 판 밑 안내, 아래는 여백 24 만
 */
export function reserveFor(
  wide: boolean,
  notices: number,
  panelOpen = false,
): { top: number; bottom: number } {
  if (wide) return { top: 24 + Math.max(notices, 44), bottom: 108 }
  if (panelOpen) return { top: 24 + (notices > 0 ? 8 + notices : 0), bottom: 24 }
  return { top: notices > 0 ? 80 + notices : 72, bottom: 96 }
}

export type Droppable = 'hint' | 'shrunk'

export type DropState = { signature: string; level: number; at: number }

/**
 * 순수 — 쌓인 높이가 화면 절반을 넘으면(`over`) 한 번 잴 때마다(`stamp`) 알약을 하나씩 더 뺀다(`level` 이 `count` 까지).
 * `signature` 가 바뀌면 처음부터. 아무 일도 없으면 같은 객체를 돌려준다
 */
export function nextDropState(
  state: DropState,
  input: { over: boolean; stamp: number; count: number; signature: string },
): DropState {
  const current =
    state.signature === input.signature ? state : { signature: input.signature, level: 0, at: -1 }
  if (input.over && current.level < input.count && input.stamp !== current.at)
    return { signature: input.signature, level: current.level + 1, at: input.stamp }
  return current
}

/**
 * 쌓인 높이가 화면 높이 절반을 넘으면 [order](빼도 되는 알약, 먼저 뺄 것부터 — 조작 안내 → 축소 알약)를 하나씩 뺀다.
 * 한 알약을 뺀 뒤에는 다시 재질 때까지(`stamp` 가 바뀔 때까지) 다음 것을 빼지 않는다.
 * 빼면 높이가 줄어 되돌아오는 떨림이 없게, 한 번 뺀 것은 [signature](무대 크기 · 어떤 알약이 있나 — 뺀 뒤가 아닌 원래 값)가 바뀔 때까지 그대로 둔다
 */
export function useDropNotices(
  over: boolean,
  stamp: number,
  order: Droppable[],
  signature: string,
): Set<Droppable> {
  const [state, setState] = useState<DropState>({ signature: '', level: 0, at: -1 })
  const next = nextDropState(state, { over, stamp, count: order.length, signature })
  const before = state.signature === signature ? state.level : 0
  if (next.level > before) setState(next)
  return new Set(order.slice(0, next.level))
}
