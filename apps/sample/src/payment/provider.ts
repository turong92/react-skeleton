/**
 * 어느 결제사로 결제하는가 - 견본 앱의 규칙: 구매자 나라가 한국이면 토스, 아니면 Paddle(해외, 여러 통화).
 * 설정 `VITE_PAYMENT_PROVIDER=toss|paddle` 로 모두를 한 결제사로 돌릴 수 있다(없거나 `auto` 면 나라로 고른다).
 * 고른 결제사가 서버에 켜져 있지 않으면(`providers` 에 없음) 켜진 쪽으로 간다. 서버가 목록을 안 주면(구버전) `undefined` - 서버가 고른다.
 */
export function chooseProvider({
  providers,
  country,
  forced,
}: {
  providers: readonly string[] | undefined
  country: string
  forced?: string | undefined
}): string | undefined {
  if (!providers || providers.length === 0) return undefined
  const wanted =
    forced && forced !== 'auto' ? forced : country.toUpperCase() === 'KR' ? 'toss' : 'paddle'
  return providers.includes(wanted) ? wanted : providers[0]
}

/** 빌드 설정 - 모두를 한 결제사로 돌린다. 비어 있거나 `auto` 면 나라로 고른다 */
export const FORCED_PROVIDER: string | undefined =
  (
    import.meta as { env?: Record<string, string | undefined> }
  ).env?.VITE_PAYMENT_PROVIDER?.trim() || undefined
