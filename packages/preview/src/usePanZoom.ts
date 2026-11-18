import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from 'react'
import {
  clampPan,
  clampScale,
  fitScale,
  nextStep,
  zoomAround,
  type Point,
  type Size,
  type ZoomMode,
} from './zoom'

/** 고른 배율과 이동 위치. `pan` 이 null 이면 기본 자리(위쪽 가운데) — 맞추기는 뷰포트가 바뀔 때마다 다시 가운데로 */
type View = { mode: ZoomMode; pan: Point | null }

/** 화살표 한 번에 옮기는 거리(px) — Shift 면 네 배 */
const ARROW_STEP = 40
/** Ctrl/⌘ + 휠 한 칸(마우스 약 100)에 약 0.82 배 — 트랙패드 핀치(작은 delta)는 부드럽게 */
const WHEEL_ZOOM = 0.002
const LINE_PX = 16

/** 순수 — 고른 배율 · 이동 → 그릴 값 */
export function derivePanZoom(
  view: View,
  content: Size,
  viewport: Size,
): { fit: number; scale: number; pan: Point; pannable: boolean } {
  const fit = fitScale(content, viewport)
  const scale = view.mode === 'fit' ? fit : view.mode === 'actual' ? 1 : clampScale(view.mode, fit)
  const scaled = { width: content.width * scale, height: content.height * scale }
  const start = view.pan ?? { x: (viewport.width - scaled.width) / 2, y: 0 }
  const pan = clampPan(start, scaled, viewport)
  // 반 픽셀 여유 — 맞추기 배율의 부동소수 오차로 「이동할 수 있다」가 되지 않게
  const pannable = scaled.width > viewport.width + 0.5 || scaled.height > viewport.height + 0.5
  return { fit, scale, pan, pannable }
}

export type PanZoomKey = { pan: Point } | { zoom: 1 | -1 } | { fit: true }

/** 순수 — 키 하나의 뜻. 조합 키(Ctrl · ⌘ · Alt)는 null(브라우저 확대를 건드리지 않는다) */
export function panZoomKey(e: {
  key: string
  shiftKey: boolean
  ctrlKey: boolean
  metaKey: boolean
  altKey: boolean
}): PanZoomKey | null {
  if (e.ctrlKey || e.metaKey || e.altKey) return null
  const step = e.shiftKey ? ARROW_STEP * 4 : ARROW_STEP
  switch (e.key) {
    case 'ArrowLeft':
      return { pan: { x: step, y: 0 } }
    case 'ArrowRight':
      return { pan: { x: -step, y: 0 } }
    case 'ArrowUp':
      return { pan: { x: 0, y: step } }
    case 'ArrowDown':
      return { pan: { x: 0, y: -step } }
    case '+':
    case '=':
      return { zoom: 1 }
    case '-':
    case '_':
      return { zoom: -1 }
    case '0':
      return { fit: true }
    default:
      return null
  }
}

export type PanZoom = {
  mode: ZoomMode
  /** 지금 그리는 배율 — 감싸개의 `transform: scale()` 에 쓴다 */
  scale: number
  /** 뷰포트 왼쪽 위 기준 콘텐츠 왼쪽 위(px) — `translate` 값. 늘 콘텐츠 안으로 잘려 있다 */
  pan: Point
  /** 맞추기 배율 — 뷰포트에 기기 전체가 들어가는 배율(1 이하) */
  fit: number
  /** 콘텐츠가 뷰포트보다 커서 옮길 것이 있다 */
  pannable: boolean
  /** 'fit' 은 맞추기, 숫자 · 'actual' 은 뷰포트 가운데를 기준으로 그 배율 */
  setScale: (mode: ZoomMode) => void
  /** 한 단계 위 · 아래 — 맞추기보다 작게는 줄이지 않는다. [origin] 은 뷰포트 좌표(없으면 가운데) */
  zoomBy: (dir: 1 | -1, origin?: Point) => void
  /** 뷰포트 요소에 펼친다 — 포인터(끌기 · 두 손가락) · 키보드 · 휠(ref 로 passive 아님) */
  bind: {
    ref: (element: HTMLElement | null) => void
    onPointerDown: (event: PointerEvent<HTMLElement>) => void
    onPointerMove: (event: PointerEvent<HTMLElement>) => void
    onPointerUp: (event: PointerEvent<HTMLElement>) => void
    onPointerCancel: (event: PointerEvent<HTMLElement>) => void
    onLostPointerCapture: (event: PointerEvent<HTMLElement>) => void
    onPointerLeave: (event: PointerEvent<HTMLElement>) => void
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => void
  }
}

/**
 * 확대 보기의 배율 · 이동 상태. 계산은 `zoom.ts` 순수 함수로.
 * [content] 는 배율 1 의 콘텐츠 크기(기기 틀까지), [viewport] 는 보이는 자리 크기
 */
export function usePanZoom({
  content,
  viewport,
  initial,
  inset = 0,
  passThrough = false,
}: {
  content: Size
  viewport: Size
  initial: ZoomMode
  /**
   * 묶은 요소 안에서 [viewport] 자리가 시작하는 틈(px) — 커서 · 손가락 기준점을 그 자리 좌표로 옮긴다.
   * 숫자는 네 둘레 같은 값, `{x, top}` 은 옆 · 위만(아래 자리는 [viewport] 높이가 이미 뺐다).
   * `pan` 은 늘 [viewport] 칸 기준 — `translate` 에는 부르는 쪽이 x · top(숫자면 그 값)을 더한다
   */
  inset?: number | { x: number; top: number }
  /**
   * 무대 바탕(이벤트 대상이 무대 자신)에서 난 입력만 처리하고, 화면 안 요소에서 올라온 포인터 · 키 · 휠은 건드리지 않는다 —
   * 직접 렌더한 내용이 자기 스크롤 · 입력칸을 쓰게(iframe 은 이벤트가 안쪽 문서에 머물러 필요 없다)
   */
  passThrough?: boolean
}): PanZoom {
  const insetX = typeof inset === 'number' ? inset : inset.x
  const insetTop = typeof inset === 'number' ? inset : inset.top
  const [view, setView] = useState<View>({ mode: initial, pan: null })
  const [element, setElement] = useState<HTMLElement | null>(null)
  const viewRef = useRef(view)
  const sizes = useRef({ content, viewport })
  const pointers = useRef(new Map<number, Point>())
  useLayoutEffect(() => {
    sizes.current = { content, viewport }
  })

  const current = useCallback(
    () => derivePanZoom(viewRef.current, sizes.current.content, sizes.current.viewport),
    [],
  )

  /** 잘린 이동 위치로 남긴다 — 끝을 넘겨 끈 만큼 되돌려 끌어야 하는 일이 없게. 맞추기는 null 로 두어 다시 가운데로 */
  const commit = useCallback((mode: ZoomMode, pan: Point | null) => {
    const { content: c, viewport: v } = sizes.current
    const next: View = { mode, pan: pan && derivePanZoom({ mode, pan }, c, v).pan }
    viewRef.current = next
    setView(next)
  }, [])

  const center = useCallback(
    (): Point => ({ x: sizes.current.viewport.width / 2, y: sizes.current.viewport.height / 2 }),
    [],
  )

  const zoomTo = useCallback(
    (target: number, origin?: Point) => {
      const now = current()
      const to = clampScale(target, now.fit)
      commit(to, zoomAround(now.pan, origin ?? center(), now.scale, to))
    },
    [commit, current, center],
  )

  const panBy = useCallback(
    (dx: number, dy: number) => {
      const now = current()
      commit(viewRef.current.mode, { x: now.pan.x + dx, y: now.pan.y + dy })
    },
    [commit, current],
  )

  const setScale = useCallback(
    (mode: ZoomMode) => {
      if (mode === 'fit') commit('fit', null)
      // 아직 옮기지 않았으면(맞추기 · 처음) 기본 자리(위쪽 가운데) 그대로 — 칩으로 실제 크기를 연 것과 같은 자리
      else if (viewRef.current.pan === null) {
        const target = mode === 'actual' ? 1 : mode
        commit(clampScale(target, current().fit), null)
      } else zoomTo(mode === 'actual' ? 1 : mode)
    },
    [commit, current, zoomTo],
  )

  const zoomBy = useCallback(
    (dir: 1 | -1, origin?: Point) => {
      const now = current()
      const next = nextStep(now.scale, dir)
      if (next !== now.scale) zoomTo(next, origin)
      // 단계 아래 끝(0.5)보다 맞추기가 작으면 − 는 맞추기로 — 큰 기기 전체를 다시 본다
      else if (dir === -1 && now.fit < now.scale) commit('fit', null)
    },
    [commit, current, zoomTo],
  )

  const originOf = useCallback(
    (clientX: number, clientY: number): Point => {
      const rect = element?.getBoundingClientRect()
      return { x: clientX - (rect?.left ?? 0) - insetX, y: clientY - (rect?.top ?? 0) - insetTop }
    },
    [element, insetX, insetTop],
  )

  // React 의 onWheel 은 passive 라 기본 스크롤을 못 막는다 — 요소에 직접 단다
  useEffect(() => {
    if (!element) return
    function onWheel(event: WheelEvent) {
      if (passThrough && event.target !== element) return
      event.preventDefault()
      const unit =
        event.deltaMode === 1 ? LINE_PX : event.deltaMode === 2 ? sizes.current.viewport.height : 1
      if (event.ctrlKey || event.metaKey) {
        const now = current()
        zoomTo(
          now.scale * Math.exp(-event.deltaY * unit * WHEEL_ZOOM),
          originOf(event.clientX, event.clientY),
        )
      } else {
        panBy(-event.deltaX * unit, -event.deltaY * unit)
      }
    }
    element.addEventListener('wheel', onWheel, { passive: false })
    return () => element.removeEventListener('wheel', onWheel)
  }, [element, current, zoomTo, panBy, originOf, passThrough])

  function onPointerDown(event: PointerEvent<HTMLElement>) {
    if (passThrough && event.target !== event.currentTarget) return
    if (event.pointerType === 'mouse' && event.button !== 0) return
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    try {
      event.currentTarget.setPointerCapture?.(event.pointerId)
    } catch {
      // 이미 끝난 포인터 — 붙잡지 못해도 움직임은 받는다
    }
  }

  function onPointerMove(event: PointerEvent<HTMLElement>) {
    const last = pointers.current.get(event.pointerId)
    if (!last) return
    const point = { x: event.clientX, y: event.clientY }
    if (pointers.current.size === 1) {
      panBy(point.x - last.x, point.y - last.y)
    } else {
      // 두 손가락 — 사이 거리로 배율, 가운데 점의 움직임으로 이동
      const other = [...pointers.current.entries()].find(([id]) => id !== event.pointerId)?.[1]
      if (other) {
        const before = Math.hypot(last.x - other.x, last.y - other.y)
        const after = Math.hypot(point.x - other.x, point.y - other.y)
        const midBefore = { x: (last.x + other.x) / 2, y: (last.y + other.y) / 2 }
        const midAfter = { x: (point.x + other.x) / 2, y: (point.y + other.y) / 2 }
        const now = current()
        const to = before > 0 ? clampScale(now.scale * (after / before), now.fit) : now.scale
        const zoomed = zoomAround(now.pan, originOf(midBefore.x, midBefore.y), now.scale, to)
        commit(to, {
          x: zoomed.x + midAfter.x - midBefore.x,
          y: zoomed.y + midAfter.y - midBefore.y,
        })
      }
    }
    pointers.current.set(event.pointerId, point)
  }

  function onPointerEnd(event: PointerEvent<HTMLElement>) {
    pointers.current.delete(event.pointerId)
  }

  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (passThrough && event.target !== event.currentTarget) return
    const key = panZoomKey(event)
    if (!key) return
    if ('pan' in key) panBy(key.pan.x, key.pan.y)
    else if ('zoom' in key) zoomBy(key.zoom)
    else setScale('fit')
    event.preventDefault()
  }

  const derived = derivePanZoom(view, content, viewport)
  return {
    mode: view.mode,
    scale: derived.scale,
    fit: derived.fit,
    pan: derived.pan,
    pannable: derived.pannable,
    setScale,
    zoomBy,
    bind: {
      ref: setElement,
      onPointerDown,
      onPointerMove,
      onPointerUp: onPointerEnd,
      onPointerCancel: onPointerEnd,
      // 붙잡기를 잃었거나 붙잡지 못한 채 나간 포인터가 남으면 다음 끌기가 두 손가락(핀치)으로 읽힌다
      onLostPointerCapture: onPointerEnd,
      onPointerLeave: onPointerEnd,
      onKeyDown,
    },
  }
}
