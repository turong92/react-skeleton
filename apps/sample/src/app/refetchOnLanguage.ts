import { paymentKeys } from '@skeleton/payment'
import type { QueryClient } from '@tanstack/react-query'

/**
 * 화면 언어가 바뀌면 서버가 요청 언어(`Accept-Language`)로 이름을 고르는 응답 - 플랜 · 내 구독 · 카탈로그(`['payment', …]`) - 을 다시 읽는다.
 * 안 그러면 언어를 바꿔도 플랜 이름이 옛 언어로 남는다. 돌려주는 함수가 구독을 푼다
 */
export function refetchOnLanguageChange(
  i18n: { getLocale(): string; subscribe(listener: () => void): () => void },
  client: Pick<QueryClient, 'invalidateQueries'>,
): () => void {
  let last = i18n.getLocale()
  return i18n.subscribe(() => {
    const now = i18n.getLocale()
    if (now === last) return
    last = now
    void client.invalidateQueries({ queryKey: paymentKeys.all })
  })
}
