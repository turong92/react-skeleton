import type { PreviewDevice } from './devices'

/** 알약에 이을 조각 — 그리기는 부르는 쪽이 문구로. 다 비는 일은 없다 */
export type ViewerSummary = {
  device: PreviewDevice | null
  percent: number | null
  extra: readonly string[]
}

/**
 * 읽어야 할 것만 — 폰이면 기기 이름을 빼고, 맞추기면 배율을 빼고, 배율을 바꿨으면 `extra` 를 뺀다
 * (그때 알약이 말하는 것은 「얼마나 줄었나」). 다 비면 device 'phone'
 */
export function viewerSummary(input: {
  device: PreviewDevice
  fit: boolean
  percent: number
  extra?: readonly string[]
}): ViewerSummary {
  const summary: ViewerSummary = {
    device: input.device === 'phone' ? null : input.device,
    percent: input.fit ? null : input.percent,
    extra: input.fit ? (input.extra ?? []) : [],
  }
  const empty = summary.device === null && summary.percent === null && summary.extra.length === 0
  return empty ? { ...summary, device: 'phone' } : summary
}
