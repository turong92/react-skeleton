/** 순간(ISO) → `datetime-local` 칸의 글자(내 기기의 시간대) */
export function toLocalInput(iso: string | null): string {
  if (iso === null) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/**
 * 끝나는 시각 칸 → 서버로 보낼 값. 비우면 끝 없음(`null`). 시작 시각이 있으면 그보다 늦어야 한다.
 * 틀리면 이유만 돌려준다 - 겹침 같은 최종 판단은 서버(`CATALOG.PRICE_OVERLAP`)가 한다
 */
export function validateSaleEnd(
  local: string,
  saleStartsAt: string | null,
):
  | { value: string | null; problem: null }
  | { value: null; problem: 'timeInvalid' | 'endBeforeStart' } {
  if (local === '') return { value: null, problem: null }
  const at = new Date(local)
  if (Number.isNaN(at.getTime())) return { value: null, problem: 'timeInvalid' }
  if (saleStartsAt !== null && at <= new Date(saleStartsAt))
    return { value: null, problem: 'endBeforeStart' }
  return { value: at.toISOString(), problem: null }
}
