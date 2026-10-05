/* 테스트 전용 — JWT 꼴 토큰(서명 없음) */
export function fakeJwt(claims: Record<string, unknown>): string {
  const payload = btoa(JSON.stringify(claims))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '')
  return `header.${payload}.signature`
}
