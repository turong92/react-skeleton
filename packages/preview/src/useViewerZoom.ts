import { useCallback, useEffect, useRef, useState } from 'react'
import { deviceViewport, type PcWidth, type PreviewDevice } from './devices'
import { frameInsets, paintedBox, type FrameKind } from './frame'
import { reserveFor } from './noticeStack'
import { usePanZoom, type PanZoom } from './usePanZoom'

/** 무대 가장자리 숨 쉴 틈(px) — 맞추기도 이동 끝도 기기가 무대 끝에 붙지 않게 */
const GUTTER = 16

/** 알약 글 폭을 아직 못 쟀을 때(첫 그림) 기기 옆에 둘 최소 옆 칸(px) */
export const SHRUNK_SIDE_MIN = 180

/** 축소 알약이 무대 왼쪽에서 띄는 자리 + 기기와의 틈 */
const SHRUNK_EDGE = 12
const SHRUNK_GAP = 8

/** 축소 알약 폭 — 알약이 없어 0 이 재어져도 마지막으로 잰 폭을 지우지 않는다(지우면 기준이 떨어져 옆 ↔ 쌓기가 되풀이된다) */
export function keepMeasured(before: number, measured: number): number {
  return measured > 0 ? measured : before
}

/** 옆 ↔ 쌓기를 가르는 기준에서 몇 px 안쪽은 지금 자리를 유지한다 — 알약 높이가 바뀌어 배율이 조금 변해도 깜빡이지 않게 */
const BESIDE_SLACK = 8

/** 옆 칸 [room] 이 알약 [need] 를 받는가 — 옆에 있던 [was] 면 [need] 보다 조금 좁아도 유지, 쌓여 있었으면 조금 넓어야 옮긴다 */
export function besideFits(room: number, need: number, was: boolean): boolean {
  return was ? room >= need - BESIDE_SLACK : room >= need + BESIDE_SLACK
}

/**
 * 기기 옆 칸(px) 아래 한계 — 알약이 기기에 겹치지 않게 배율이 가장 클 때로 잰다. 배율 위 한계는
 * 가로 폭(1)과 높이(판 · 쌓인 안내 없이 기본 비움 자리만 뺀 칸), 끌어 맞춘 손 배율이면 그 배율. 알약이 옆에 있든 쌓여 있든 값이 같아 흔들리지 않는다
 */
export function besideRoom({
  stage,
  content,
  gutter,
  panel,
  manualScale,
}: {
  stage: { width: number; height: number }
  /** 칠해지는 기기 폭 · 틀 포함 높이(배율 1) */
  content: { width: number; height: number }
  gutter: number
  /** 열린 판 높이(0 이면 접힘) */
  panel: number
  /** 맞추기가 아닐 때의 배율, 맞추기면 0 */
  manualScale: number
}): number {
  const base = reserveFor(false, 0, panel > 0)
  const widthCap = Math.max(0, stage.width - gutter * 2) / content.width
  const heightCap = Math.max(0, stage.height - base.top - base.bottom - panel) / content.height
  const scale = Math.min(1, widthCap, Math.max(heightCap, manualScale))
  return (stage.width - content.width * scale) / 2
}

/** 판 밑에 남겨야 하는 칸 — 무대 높이 비율. 모자라면 판 자리를 빼지 않는다 */
const PANEL_MIN_ROOM = 0.4

/**
 * 크게 보기 무대의 배율 · 이동 — 무대 크기를 재고(ResizeObserver) 위 · 아래 자리를 뺀 칸을 `usePanZoom` 에 넘긴다.
 * `usePanZoom` 의 `pan` 은 그 칸 기준이라 `translate`(무대 기준)는 여기서 옆 · 위 틈을 더해 준다.
 * [reserve] 는 칸에서 뺄 자리(px) — 위 = 안내 줄, 아래 = 막대 · 패드.
 * [fluid] 는 꽉 찬 폰 — 틀 없이 화면 = 무대 크기, 배율 1 · 이동 없음(문서는 iframe 안에서 스크롤)
 */
export function useViewerZoom({
  device,
  pcWidth,
  reserve,
  fluid = false,
  panel = 0,
  panelReserve = reserve,
  shrunkWidth = 0,
}: {
  device: PreviewDevice
  pcWidth: PcWidth
  reserve: { top: number; bottom: number }
  /** 위에 얹힌 펴기 판 높이(px) — 판 밑 남는 칸이 무대의 `PANEL_MIN_ROOM` 이상일 때만 더한다(폰처럼 좁으면 기기가 터무니없이 작아지니 판 뒤에 둔다) */
  panel?: number
  /** 기기를 판 밑으로 내릴 때의 [reserve] — 판이 열린 동안은 위 알약 · 아래 패드가 없다 */
  panelReserve?: { top: number; bottom: number }
  /** 축소 알약의 글 전체 폭(px, 잰 값) — 기기 옆 칸이 이보다 넓어야 옆에 둔다. 0 이면 아직 못 쟀다 */
  shrunkWidth?: number
  fluid?: boolean
}): {
  /** 무대 크기(px) */
  stage: { width: number; height: number }
  zoom: PanZoom
  stageRef: (el: HTMLElement | null) => void
  /** 무대 요소 — 모달이 처음 포커스를 줄 곳 */
  stageEl: { current: HTMLElement | null }
  screen: { width: number; height: number }
  kind: FrameKind
  shrunk: boolean
  /** `zoom.pan`(칸 기준)에 더해 무대 기준 `translate` 로 만드는 몫 — 옆 틈 + PC 받침 여유 · 위 안내 줄 자리 */
  offset: { x: number; top: number }
  /**
   * 축소 알약을 기기 옆(왼쪽 위 바깥)에 둘 수 있나 — 옆 칸은 배율이 가장 클 때(가로 폭만 보고 1 까지)로 재서 알약이 어디 있든 값이 흔들리지 않는다.
   * [top] 은 기기 위 끝(무대 기준), [maxWidth] 는 알약이 쓸 수 있는 폭
   */
  beside: { top: number; maxWidth: number } | null
} {
  const [size, setSize] = useState({ width: 0, height: 0 })
  const stageEl = useRef<HTMLElement | null>(null)
  const [element, setElement] = useState<HTMLElement | null>(null)

  const spec = fluid
    ? { width: size.width, height: size.height, frame: 'plain' as const }
    : deviceViewport(device, pcWidth)
  const kind = spec.frame
  const insets = frameInsets(kind)
  const outerWidth = spec.width + insets.x * 2
  // 받침이 바깥 상자 양옆으로 나온다 — 맞추기 · 이동 끝은 칠해지는 폭으로 잰다
  const painted = paintedBox(kind, outerWidth)
  const gutter = fluid ? 0 : GUTTER
  const panelRoom =
    panel > 0 &&
    size.height - panelReserve.top - panelReserve.bottom - panel >= size.height * PANEL_MIN_ROOM
      ? panel
      : 0
  const room = fluid
    ? { top: 0, bottom: 0 }
    : panelRoom > 0
      ? { top: panelReserve.top + panelRoom, bottom: panelReserve.bottom }
      : reserve
  const zoom = usePanZoom({
    content: {
      width: painted.width,
      height: spec.height + insets.top + insets.bottom,
    },
    viewport: {
      width: Math.max(0, size.width - gutter * 2),
      height: Math.max(0, size.height - room.top - room.bottom),
    },
    initial: 'fit',
    inset: { x: gutter, top: room.top },
  })

  useEffect(() => {
    if (!element || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setSize({ width, height })
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [element])

  const bindRef = zoom.bind.ref
  const stageRef = useCallback(
    (el: HTMLElement | null) => {
      stageEl.current = el
      setElement(el)
      bindRef(el)
    },
    [bindRef],
  )

  const sideRoom = besideRoom({
    stage: size,
    content: { width: painted.width, height: spec.height + insets.top + insets.bottom },
    gutter,
    panel,
    manualScale: zoom.mode === 'fit' ? 0 : zoom.scale,
  })
  const deviceLeft = zoom.pan.x + gutter
  // 옆 칸이 알약을 받는가 — 기준 언저리는 지금 자리를 유지(렌더 중 파생 상태, 값이 바뀔 때만 저장)
  const [wasBeside, setWasBeside] = useState(false)
  const roomForPill = besideFits(
    sideRoom,
    shrunkWidth > 0 ? shrunkWidth + SHRUNK_EDGE + SHRUNK_GAP : SHRUNK_SIDE_MIN,
    wasBeside,
  )
  if (roomForPill !== wasBeside) setWasBeside(roomForPill)

  return {
    stage: size,
    zoom,
    stageRef,
    stageEl,
    screen: { width: spec.width, height: spec.height },
    kind,
    shrunk: !fluid && Math.round(zoom.scale * 100) < 100,
    offset: fluid ? { x: 0, top: 0 } : { x: gutter + painted.left * zoom.scale, top: room.top },
    // 판이 열려 있는데 기기가 판 뒤에 남으면(판 밑 칸 모자람) 기기 위 끝은 판 높이와 겹친다 — 흐름에 둔다.
    // 위 끝은 `room.top` 아래로 클램프 — 끌어서 옮겨도 알약이 판 · 위 알약 위로 올라가지 않는다
    beside:
      fluid || !roomForPill || (panel > 0 && panelRoom === 0)
        ? null
        : {
            top: Math.max(room.top, zoom.pan.y + room.top),
            maxWidth: Math.max(0, deviceLeft - SHRUNK_EDGE - SHRUNK_GAP),
          },
  }
}
