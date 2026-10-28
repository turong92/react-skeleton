const pad = (n: number) => String(n).padStart(2, '0')

/** ISO 시각 → `datetime-local` 칸의 값(브라우저 시간대의 `YYYY-MM-DDTHH:mm`). 비었거나 읽을 수 없으면 빈 글자 */
export function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** `datetime-local` 칸의 값 → ISO 시각(UTC). 비었으면 null */
export function fromLocalInput(value: string): string | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}
