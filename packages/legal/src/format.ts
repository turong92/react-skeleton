/** 날짜 서식 — 서버 렌더와 브라우저가 같은 글자를 내도록 시간대를 명시한다(기본 UTC). 효력일은 `YYYY-MM-DD` 하루 단위로, 동의 시각은 `time: true` */
export function formatWhen(
  iso: string,
  {
    locale = 'en-US',
    zone = 'UTC',
    time = false,
  }: { locale?: string; zone?: string; time?: boolean } = {},
): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: zone,
    dateStyle: 'medium',
    ...(time ? { timeStyle: 'short' as const } : {}),
  }).format(new Date(iso))
}
