import type { Order } from '@skeleton/payment'

/**
 * 결과 화면이 읽을 주문. 서버가 다시 읽어 준 것(`read`)이 이긴다 — 단 아직 「결제 전」(`PENDING`)이면 승인 · 그만둠 호출 자신의 답(`reply`)이 더 새롭다.
 * 결제창이 실패 주소로 돌려보냈으면(`left`) 주소가 말한 대로 읽는다 — 사람이 창을 닫았으면(`canceled`) 「그만뒀어요」, 아니면(`failed`) 「결제 안 됨」.
 * 그만둠 호출의 답이 오기 전(`PENDING`)이나 닫힌 뒤(`CANCELED`)에도 같다. 서버가 돈이 움직였다고 하면(`PAID` · `CONFIRMING` · 환불) 그 말이 진실이다.
 */
export function shownOrderOf({
  read,
  reply,
  left,
}: {
  read?: Order
  reply?: Order
  left?: 'canceled' | 'failed'
}): Order | undefined {
  const shown = read && read.status !== 'PENDING' ? read : (reply ?? read)
  if (shown && left && (shown.status === 'PENDING' || shown.status === 'CANCELED'))
    return { ...shown, status: left === 'canceled' ? 'CANCELED' : 'FAILED' }
  return shown
}
