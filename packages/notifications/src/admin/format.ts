const pad = (n: number) => String(n).padStart(2, '0')

/** ISO 시각 → `datetime-local` 칸의 값(브라우저 시간대의 `YYYY-MM-DDTHH:mm`). 비었거나 읽을 수 없으면 빈 글자 */
export function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** `datetime-local` 칸의 값 → ISO 시각(UTC). 비었거나 읽을 수 없으면 null */
export function fromLocalInput(value: string): string | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

/** 광고성 공지의 야간(21시~다음 날 08시, 브라우저 시간대) - 야간 수신 동의가 없는 사람은 08시 뒤에 받는다 */
export function isNightHour(date: Date): boolean {
  const hour = date.getHours()
  return hour >= 21 || hour < 8
}

/** `done / total` 을 `n%` 로 - 나눌 수가 0 이면 `-` */
export function percent(done: number, total: number): string {
  return total > 0 ? `${Math.round((done / total) * 100)}%` : '-'
}

/** 앱 안 경로만(`/` 로 시작, `//` 아님) - 서버가 다시 판정한다 */
export const isAppPath = (link: string) => link.startsWith('/') && !link.startsWith('//')
