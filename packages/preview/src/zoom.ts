/*
 * 미리보기 배율 — 순수 계산만.
 * 불변 조건: iframe 레이아웃 폭 · 높이는 언제나 고른 기기의 CSS 뷰포트다. 배율은 바깥 감싸개의 `transform: scale()` 에만 쓴다 —
 * 큰 기기를 좁은 무대에서 골라도 레이아웃을 좁혀(꾸겨) 그리지 않고 통째로 줄인다.
 * 여기 넘기는 `device` 는 무대에 놓이는 바깥 크기(기기 틀까지)다.
 */

export type Size = { width: number; height: number }
export type Point = { x: number; y: number }

/** 'fit' = 무대에 맞춤, 'actual' = 1:1, 숫자 = 배율(0.5 ~ 2) */
export type ZoomMode = 'fit' | 'actual' | number

export const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const

const ZOOM_MIN = ZOOM_STEPS[0]
const ZOOM_MAX = ZOOM_STEPS[ZOOM_STEPS.length - 1]
/** 단계 비교의 부동소수 여유 — 맞추기 배율이 단계와 거의 같으면 같은 단계로 본다 */
const EPSILON = 1e-6

/**
 * 무대에 기기 전체가 들어가는 배율. `max`(기본 1)를 넘지 않는다.
 * 높이가 null(높이를 재지 않는 칸)이거나 어느 축이 0(아직 못 잼 · 접힌 칸)이면 그 축으로는 줄이지 않는다
 */
export function fitScale(
  device: Size,
  stage: { width: number; height: number | null },
  max = 1,
): number {
  const byWidth = stage.width > 0 ? stage.width / device.width : 1
  const byHeight = stage.height !== null && stage.height > 0 ? stage.height / device.height : 1
  return Math.min(max, byWidth, byHeight)
}

/**
 * 지금 배율에서 한 단계 위(1) · 아래(-1). 맞추기 배율처럼 단계 사이에 있으면 가는 쪽의 가장 가까운 단계.
 * 2 위 · 0.5 아래 단계는 없다 — 0.5 보다 작은 맞추기 배율에서 아래로는 그대로, 위로는 0.5.
 * 2 보다 큰 배율에서 위로는 그대로(+ 가 줄이지 않는다)
 */
export function nextStep(scale: number, dir: 1 | -1): number {
  if (dir === 1) {
    const up = ZOOM_STEPS.find((step) => step > scale + EPSILON)
    return up ?? scale
  }
  const down = [...ZOOM_STEPS].reverse().find((step) => step < scale - EPSILON)
  return down ?? scale
}

/**
 * 이동 위치를 자른다. `pan` 은 뷰포트 왼쪽 위 기준 콘텐츠 왼쪽 위의 위치(px, `translate` 값),
 * `content` 는 배율을 곱한 크기. 축마다 — 콘텐츠가 뷰포트보다 작거나 같으면 가운데에 고정, 크면 가장자리가 뷰포트 끝에 닿을 때까지만
 */
export function clampPan(pan: Point, content: Size, viewport: Size): Point {
  return {
    x: clampAxis(pan.x, content.width, viewport.width),
    y: clampAxis(pan.y, content.height, viewport.height),
  }
}

function clampAxis(value: number, content: number, viewport: number): number {
  if (content <= viewport) return (viewport - content) / 2
  return Math.min(0, Math.max(viewport - content, value))
}

/**
 * 연속 배율(핀치 · 휠)을 자른다 — 위는 2, 아래는 0.5 와 맞추기 배율 중 작은 쪽.
 * 큰 기기를 좁은 화면에서 볼 땐 맞추기(예 0.2)까지 줄일 수 있어야 전체가 보인다
 */
export function clampScale(scale: number, fit: number): number {
  if (!Number.isFinite(scale)) return 1
  return Math.min(ZOOM_MAX, Math.max(Math.min(ZOOM_MIN, fit), scale))
}

/** 배율을 [from] → [to] 로 바꿀 때 [origin](뷰포트 좌표) 아래의 콘텐츠 점이 제자리에 남는 이동 위치 */
export function zoomAround(pan: Point, origin: Point, from: number, to: number): Point {
  const ratio = from > 0 ? to / from : 1
  return {
    x: origin.x - (origin.x - pan.x) * ratio,
    y: origin.y - (origin.y - pan.y) * ratio,
  }
}

/** 더 키울 · 줄일 수 없는 끝 — 배율 단추 잠금 */
export function zoomEnds(scale: number, fit: number): { atMax: boolean; atMin: boolean } {
  return {
    atMax: scale >= ZOOM_MAX - EPSILON,
    atMin: scale <= Math.min(ZOOM_MIN, fit) + EPSILON,
  }
}
