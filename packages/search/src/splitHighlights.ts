import type { HighlightRange } from './types'

export type HighlightPart = { text: string; mark: boolean }

const isHigh = (code: number) => code >= 0xd800 && code <= 0xdbff
const isLow = (code: number) => code >= 0xdc00 && code <= 0xdfff
const COMBINING = /^\p{M}$/u

/** 가장자리가 글자 한가운데(서로게이트 쌍 · 결합 문자 앞)에 떨어지면 글자 밖으로 넓힌다 - 글자가 반으로 갈리지 않게 */
function snap(text: string, start: number, end: number): [number, number] {
  let from = start
  let to = end
  while (from > 0 && (isLow(text.charCodeAt(from)) || COMBINING.test(text[from] ?? ''))) from--
  while (to < text.length && (isLow(text.charCodeAt(to)) || COMBINING.test(text[to] ?? ''))) to++
  if (to > 0 && to < text.length && isHigh(text.charCodeAt(to - 1))) to++
  return [from, to]
}

/**
 * 서버가 준 `[시작, 끝)` UTF-16 위치(JS 문자열 인덱스와 같다)로 문자열을 일치 · 나머지 조각으로 자른다.
 * 순서가 뒤섞이거나 겹치거나 범위 밖인 위치는 걸러 내고 합친다. 결과를 이어 붙이면 언제나 원문이다.
 */
export function splitHighlights(text: string, ranges: readonly HighlightRange[]): HighlightPart[] {
  const merged: Array<[number, number]> = []
  const valid = ranges
    .map(([start, end]) => [Math.max(0, start), Math.min(text.length, end)] as const)
    .filter(([start, end]) => start < end)
    .map(([start, end]) => snap(text, start, end))
    .sort((a, b) => a[0] - b[0])
  for (const [start, end] of valid) {
    const last = merged[merged.length - 1]
    if (last && start <= last[1]) last[1] = Math.max(last[1], end)
    else merged.push([start, end])
  }

  const parts: HighlightPart[] = []
  let cursor = 0
  for (const [start, end] of merged) {
    if (start > cursor) parts.push({ text: text.slice(cursor, start), mark: false })
    parts.push({ text: text.slice(start, end), mark: true })
    cursor = end
  }
  if (cursor < text.length || parts.length === 0)
    parts.push({ text: text.slice(cursor), mark: false })
  return parts
}
