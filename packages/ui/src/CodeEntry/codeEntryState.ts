/** 숫자만 남긴다(붙여넣은 `123 456` · `123-456` 도 받는다) */
export const digitsOf = (text: string) => text.replace(/\D/g, '')

/** `index` 칸부터 `typed` 의 숫자를 채운 새 칸 목록과, 다음에 포커스할 칸(마지막 칸을 넘으면 마지막) */
export function fillFrom(
  cells: readonly string[],
  index: number,
  typed: string,
): { cells: string[]; focus: number } {
  const digits = digitsOf(typed)
  const next = [...cells]
  if (digits === '') return { cells: next, focus: index }
  let at = index
  for (const digit of digits) {
    if (at >= next.length) break
    next[at] = digit
    at += 1
  }
  return { cells: next, focus: Math.min(at, next.length - 1) }
}

/** Backspace: 칸에 값이 있으면 그 칸을 비우고, 비어 있으면 앞 칸을 비우고 그리로 간다 */
export function backspaceAt(
  cells: readonly string[],
  index: number,
): { cells: string[]; focus: number } {
  const next = [...cells]
  if (next[index] !== '') {
    next[index] = ''
    return { cells: next, focus: index }
  }
  const previous = Math.max(0, index - 1)
  next[previous] = ''
  return { cells: next, focus: previous }
}

export const isComplete = (cells: readonly string[]) => cells.every((cell) => cell !== '')
