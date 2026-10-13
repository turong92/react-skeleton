/**
 * 사용자가 언어를 고른 적이 없을 때의 첫 언어. 나라를 서버에서 받으려면 로그인 뒤 응답을 기다려야 해 첫 그리기에서 언어가 깜빡이므로, 첫 그리기 전에 아는 것만 쓴다:
 * 개발용으로 고른 나라(있으면 KR → 한국어, 그 밖 → 영어), 없으면 브라우저 언어(ko · en 중 먼저 나오는 것), 둘 다 아니면 영어.
 */
export function initialLocale({
  devCountry,
  languages,
}: {
  devCountry: string | null
  languages: readonly string[]
}): 'ko' | 'en' {
  if (devCountry) return devCountry === 'KR' ? 'ko' : 'en'
  for (const raw of languages) {
    const base = raw.toLowerCase().split(/[-_]/)[0]
    if (base === 'ko' || base === 'en') return base
  }
  return 'en'
}
