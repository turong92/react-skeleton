import { withdrawFailureKeyOf } from './withdrawFailure'

/*
 * 결제 한 건 화면의 환불 요청 배선 중 화면 없이 잴 수 있는 판정 - 컴포넌트는 이것을 부르기만 한다.
 */

/** 「요청 거두기」를 누른다 - 묵은 답(거절된 뒤의 「이미 처리됐어요」)이 새 시도 옆에 남지 않게 먼저 지우고 그 줄을 보낸다 */
export function startWithdraw(
  withdraw: { reset: () => void; mutate: (refundId: string) => void },
  refund: { id: string },
): void {
  withdraw.reset()
  withdraw.mutate(refund.id)
}

/** 거두기가 안 됐을 때 요약 아래에 말할 문장의 키(안 됐을 때만). 확정 답이면 「이미 처리됐어요」, 결과를 모르면 「다시 눌러 주세요」 */
export function withdrawNoticeKey(withdraw: { isError: boolean; error: unknown }) {
  return withdraw.isError ? withdrawFailureKeyOf(withdraw.error) : null
}

/**
 * 낡은 화면(다시 읽기 실패)에서 「환불 요청함」을 상태 글자로 말하나. 요청이 성공했고 읽기가 실패한 동안만 말하되,
 * **방금 낸 요청 줄이 목록에 있으면 말하지 않는다** - 목록의 줄이 사실을 말한다(운영자가 환불 · 거절했거나 본인이 거뒀다면 그 상태 그대로).
 * 요청 성공 → 운영자가 정함 → 다시 읽기 성공 → 나중의 다시 읽기 실패 순서에서 「환불 요청함」이 되살아나지 않게 한다(운영자 패널이 `refunded.id` 를 목록에서 찾는 것과 같은 방식).
 * 거둠은 목록에 있던 줄에서만 누를 수 있으니 같은 비교가 거둔 요청도 덮는다.
 */
export function requestedNoticeShown({
  refreshFailed,
  request,
  refunds,
}: {
  refreshFailed: boolean
  request: { isSuccess: boolean; data?: { id: string } }
  refunds: readonly { id: string }[]
}): boolean {
  if (!refreshFailed || !request.isSuccess || request.data === undefined) return false
  const id = request.data.id
  return !refunds.some((line) => line.id === id)
}
