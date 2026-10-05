/**
 * 백엔드 `modules/time` 의 `ZonedMoment` 와 1:1 — **예정된 현지 시각** (마감, 이벤트 시작).
 * `local`+`zone` 이 원본, `at` 은 정렬·비교용 파생값 (ISO, UTC `Z`).
 *
 * 시각 3종: 일어난 시점은 ISO 문자열(`...Z`) 그대로, 달력 날짜는 `YYYY-MM-DD` 문자열(변환 금지), 예정은 이 타입.
 */
export type ZonedMoment = {
  /** `2026-10-05T21:00:00` (시간대 없음) */
  local: string
  /** IANA, 예 `Asia/Seoul` */
  zone: string
  /** `2026-10-05T12:00:00Z` */
  at: string
}

export type FormatOptions = {
  /** IANA. 기본 브라우저 시간대 */
  zone?: string
  /** BCP 47. 기본 브라우저 로케일 */
  locale?: string
  dateStyle?: Intl.DateTimeFormatOptions['dateStyle']
  timeStyle?: Intl.DateTimeFormatOptions['timeStyle']
}
