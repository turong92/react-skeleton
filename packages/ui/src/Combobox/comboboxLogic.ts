export type ComboboxOption = {
  value: string
  label: string
  /** 라벨 아래 보조 글 */
  description?: string
  disabled?: boolean
}

/** 비교용 정규화 — 대소문자 · 악센트(São → sao) · 한글 조합 형태(NFC/NFD)를 무시한다 */
const fold = (text: string) =>
  text.normalize('NFD').replace(/[̀-ͯ]/g, '').normalize('NFC').toLowerCase().trim()

/** 라벨에 질의가 들어 있는 항목만(질의가 비면 전부). 정적 `options` 의 거르기 */
export function filterOptions<T extends { label: string }>(options: T[], query: string): T[] {
  const needle = fold(query)
  return needle ? options.filter((option) => fold(option.label).includes(needle)) : options
}

type MoveKey = 'ArrowDown' | 'ArrowUp' | 'Home' | 'End'

/** 목록 안의 다음 활성 순번 — 끝에서 돌고, 잠긴 항목은 건너뛴다. 갈 곳이 없으면 -1 */
export function nextActiveIndex(
  current: number,
  count: number,
  key: MoveKey,
  disabled: ReadonlySet<number> = new Set(),
): number {
  if (count === 0) return -1
  const enabled = (index: number) => !disabled.has(index)
  if (key === 'Home') return Array.from({ length: count }, (_, i) => i).find(enabled) ?? -1
  if (key === 'End')
    return Array.from({ length: count }, (_, i) => count - 1 - i).find(enabled) ?? -1
  const step = key === 'ArrowDown' ? 1 : -1
  let index = current
  for (let tries = 0; tries < count; tries += 1) {
    index =
      current === -1 && tries === 0 ? (step === 1 ? 0 : count - 1) : (index + step + count) % count
    if (enabled(index)) return index
  }
  return -1
}

/** 비동기 응답 경합 막기 — 요청마다 번호를 받고, 가장 나중 번호만 「현재」다(먼저 보낸 느린 응답이 나중에 와도 버려진다) */
export function createRequestGuard() {
  let latest = 0
  return {
    next: () => (latest += 1),
    isCurrent: (id: number) => id === latest,
    cancel: () => {
      latest += 1
    },
  }
}
