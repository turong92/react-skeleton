/** 선택지 묶음(`role="radiogroup"`) 안의 화살표 키 — 지금 칸에서 어느 칸으로 옮길지. 해당 없는 키는 `null` */
export function nextChoiceIndex(key: string, index: number, length: number): number | null {
  if (length <= 0) return null
  switch (key) {
    case 'ArrowRight':
    case 'ArrowDown':
      return (index + 1) % length
    case 'ArrowLeft':
    case 'ArrowUp':
      return (index - 1 + length) % length
    case 'Home':
      return 0
    case 'End':
      return length - 1
    default:
      return null
  }
}
