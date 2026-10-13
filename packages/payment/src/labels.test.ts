import { describe, expect, it } from 'vitest'
import { defaultPaymentLabels, koPaymentLabels, resolvePaymentLabels } from './labels'

/** 문구 맨 끝(글자)까지 걸어 `경로 → 글자` 로 편다. 함수형 문구는 예시 인자로 불러 본다 */
function leaves(value: unknown, path = ''): Array<[string, string]> {
  if (typeof value === 'string') return [[path, value]]
  if (typeof value === 'function')
    return [[path, String((value as (...a: string[]) => unknown)('X', 'Y', 'Z'))]]
  if (value && typeof value === 'object')
    return Object.entries(value).flatMap(([k, v]) => leaves(v, path ? `${path}.${k}` : k))
  return []
}

// 스펙 §11.2 표의 「쓰지 않는 말」 — 화면은 표의 낱말 하나로 통일한다. 예외 없음:
// 「취소」 는 어디에도 쓰지 않는다(환불 창의 단추도 「닫기」) — 돈을 돌려받는 일은 늘 「환불」.
// 붙여 쓴 변형(「처리중」 · 「테스트모드」)도 잡도록 공백을 모두 뗀 글자로 비교한다.
const KO_FORBIDDEN = [
  '주문',
  '구매',
  '오더',
  '트랜잭션',
  '결제 취소',
  '캔슬',
  '승인',
  '펜딩',
  '처리 중',
  '처리 대기',
  '접수',
  '반려',
  '샌드박스',
  '테스트 모드',
  '동기화',
  '싱크',
  '대사',
  '후원',
  '기부',
  '도네이션',
  '성공',
  '실패',
  '만료',
  '취소',
  '취소됨',
  '처리중',
  '처리하는 중', // 「처리 중」의 변형 - 공백을 뗀 비교에서도 「처리하는중」은 「처리중」에 안 걸린다
  '테스트모드',
  '결제취소',
]
const EN_FORBIDDEN = [
  /\borders?\b/i,
  /purchase/i,
  /transaction/i,
  /sandbox/i,
  /test mode/i,
  /\bsync/i,
  /approv/i,
  /pending/i,
  /success/i,
  /\bfail/i,
  /donat/i,
  /expire/i,
  /reject/i,
  /cancel/i,
]

describe('the words on the screen (spec 11.2)', () => {
  const ko = leaves(koPaymentLabels)
  const en = leaves(defaultPaymentLabels)

  it('reads real labels (the walker is not looking at an empty list)', () => {
    expect(ko.length).toBeGreaterThan(60)
    expect(en.length).toBe(ko.length)
  })

  const squash = (text: string) => text.replace(/\s+/g, '')

  it.each(KO_FORBIDDEN)('ko labels never say 「%s」 (spaces or not)', (word) => {
    const hit = ko.filter(([, text]) => squash(text).includes(squash(word)))
    expect(hit, `where: ${hit.map(([p]) => p).join(', ')}`).toEqual([])
  })

  it.each(EN_FORBIDDEN.map((re) => [String(re), re] as const))(
    'default (English) labels never match %s',
    (_, re) => {
      const hit = en.filter(([, text]) => re.test(text))
      expect(hit, `where: ${hit.map(([p]) => p).join(', ')}`).toEqual([])
    },
  )

  it('says the table words for the things people look for (a test that only forbids words passes on an empty screen)', () => {
    expect(koPaymentLabels.list.caption).toBe('결제 내역')
    expect(koPaymentLabels.result.viewHistory).toBe('결제 내역')
    expect(koPaymentLabels.summary.requestRefund).toBe('환불 요청')
    expect(koPaymentLabels.refundStatus.REQUESTED).toContain('환불 요청')
    expect(koPaymentLabels.refundStatus.WITHDRAWN).toBe('환불 요청 거둠')
    expect(koPaymentLabels.summary.withdrawRefund).toBe('요청 거두기')
    expect(koPaymentLabels.refundDialog.dismiss).toBe('닫기')
    expect(koPaymentLabels.result.unconfirmed.title).toBe('결제를 확인하지 못했어요')
    expect(koPaymentLabels.testMode).toContain('테스트 결제')
    expect(defaultPaymentLabels.list.caption).toBe('Payments')
    expect(defaultPaymentLabels.summary.requestRefund).toMatch(/refund/i)
  })

  it('a status the package has not heard of gets a neutral phrase, never the raw code', () => {
    expect(koPaymentLabels.unknownStatus).toBe('확인 필요')
    expect(defaultPaymentLabels.unknownStatus).toBe('Needs a check')
  })

  it('names the system-made refunds (operator, provider console), not only the three reasons a person can pick', () => {
    expect(koPaymentLabels.refundReason.OPERATOR).toBe('운영자가 환불함')
    expect(koPaymentLabels.refundReason.PROVIDER_CONSOLE).toBe('결제사에서 환불됨')
  })

  it('no sentence is written twice under two keys (change it once, it changes everywhere)', () => {
    for (const labels of [ko, en]) {
      const sentences = labels.filter(([, text]) => /\s/.test(text) && /[.?]$|요$/.test(text))
      const seen = new Map<string, string>()
      const twice = sentences.filter(([path, text]) => {
        const first = seen.get(text)
        if (first) return true
        seen.set(text, path)
        return false
      })
      expect(twice.map(([p, t]) => `${p}: ${t}`)).toEqual([])
    }
  })

  it('uses the table words for the statuses', () => {
    const s = koPaymentLabels.orderStatus
    expect(s).toMatchObject({
      PAID: '결제됨',
      FAILED: '결제 안 됨',
      EXPIRED: '시간이 지났어요',
      CANCELED: '그만뒀어요',
      CONFIRMING: '결제 확인 중',
      REFUNDED: '환불됨',
      PARTIALLY_REFUNDED: '일부 환불됨',
    })
    expect(koPaymentLabels.refundInProgress).toBe('환불 중')
    expect(koPaymentLabels.refundStatus).toMatchObject({
      REQUESTED: '환불 요청함',
      PENDING: '환불 중',
      WITHDRAWN: '환불 요청 거둠',
      SUCCEEDED: '환불됨',
      REJECTED: '환불 안 됨',
      FAILED: '환불 안 됨',
    })
    expect(koPaymentLabels.testMode).toBe('테스트 결제예요. 실제로 돈이 나가지 않아요')
  })

  it('says the subscription table words (subscribe, cancel-at-period-end) in Korean and plain English', () => {
    const sub = koPaymentLabels.subscription
    expect(sub.plans.subscribe).toBe('구독하기')
    expect(sub.mine.cancel).toBe('기간 끝에 해지')
    expect(sub.status.CANCELING).toBe('해지 예약됨')
    expect(sub.mine.endsOn('11월 1일')).toBe('11월 1일에 끝나요')
    expect(sub.cancelDialog.dismiss).toBe('닫기')
    expect(defaultPaymentLabels.subscription.plans.subscribe).toBe('Subscribe')
    expect(defaultPaymentLabels.subscription.mine.cancel).toBe('End at period end')
    expect(Object.keys(sub.mine.ended).sort()).toEqual([
      'ACCOUNT_ERASED',
      'FIRST_PAYMENT_DECLINED',
      'PAYMENT_FAILED',
      'REFUNDED',
      'RENEWAL_BLOCKED',
      'USER_CANCELED',
      'USER_CANCELED_NOW',
    ])
  })

  it('has the same keys in Korean and English', () => {
    expect(en.map(([p]) => p)).toEqual(ko.map(([p]) => p))
  })
})

describe('the operator words (spec 11.2: 「결제사와 맞추기」, 「확인 필요」, and 「환불」 for everything that gives money back)', () => {
  const a = koPaymentLabels.admin

  it('names the things an operator looks for with the table words', () => {
    expect(a.panel.sync).toBe('결제사와 맞추기')
    expect(koPaymentLabels.unknownStatus).toBe('확인 필요') // 확인 필요한 결제의 알약도 같은 글자
    expect(a.panel.refund).toBe('환불하기')
    expect(a.panel.approve).toBe('요청대로 환불하기')
    expect(a.panel.reject).toBe('요청 거절하기')
    expect(a.requests.caption).toBe('환불 요청 목록')
    expect(a.orders.caption).toBe('결제 목록')
    expect(a.orders.columns.payment).toBe('결제')
    expect(defaultPaymentLabels.admin.panel.sync).toMatch(/provider/i)
    expect(defaultPaymentLabels.admin.panel.sync).not.toMatch(/sync/i)
  })

  it('says what is true after matching when the notice stays (derived and unmatched reasons do not clear), what an inbox marker row means, and the closed-account words', () => {
    expect(a.reviewHintSynced).toBe(
      '결제사에 다시 물었지만 아직 남아 있어요. 결제사 화면에서 확인해 주세요',
    )
    expect(a.reviewHintRetrySynced).toBe(
      '끝나지 않은 그 일을 다시 걸었어요. 끝나면 이 표시가 사라져요',
    )
    expect(a.webhooks.limitMarker.waiting).toBe(
      '이 결제의 알림이 너무 많이 와서, 잠시 뒤 한 번에 확인해요',
    )
    expect(a.webhooks.limitMarker.done).toBe('이 결제의 알림이 너무 많이 와서, 한 번에 확인했어요')
    expect(a.webhooks.limitMarker.retrying).toBe(
      '이 결제의 알림이 너무 많이 와서 한 번에 확인하려 했지만, 확인하지 못해 다시 시도하고 있어요',
    )
    expect(a.webhooks.limitMarker.failed).toBe(
      '이 결제의 알림이 너무 많이 와서 한 번에 확인하려 했지만, 확인하지 못했어요. 다시 처리해 주세요',
    )
    expect(defaultPaymentLabels.admin.webhooks.limitMarker.retrying).toMatch(/tried again/i)
    expect(defaultPaymentLabels.admin.webhooks.limitMarker.retrying).not.toMatch(
      /process it again/i,
    )
    expect(defaultPaymentLabels.admin.webhooks.limitMarker.failed).toMatch(/process it again/i)
    expect(a.orders.includeErased).toBe('탈퇴한 계정의 결제도 보기')
    expect(a.erasedAccount).toBe('탈퇴한 계정')
    expect(defaultPaymentLabels.admin.orders.includeErased).toMatch(/closed account/i)
  })

  it('has a phrase for every reason an order can need a check, every history event of spec 5.4 and every inbox status', () => {
    expect(Object.keys(a.reviewReason).sort()).toEqual([
      'AMOUNT_MISMATCH',
      'BUYER_COUNTRY_KR',
      'CONFIRM_UNRESOLVED',
      'FULFILMENT_UNRESOLVED',
      'MODE_MISMATCH',
      'ORDER_MISMATCH',
      'REFUND_APPLY_UNRESOLVED',
      'REFUND_MISMATCH',
      'STALE_CONFIRMING',
      'STALE_REFUND',
      'SUBSCRIPTION_CANCEL_REFUND_UNRESOLVED',
      'SUBSCRIPTION_STALE_CHARGE',
    ])
    expect(Object.keys(a.eventTypes).sort()).toEqual(
      [
        'ORDER_CREATED',
        'CONFIRM_STARTED',
        'CONFIRM_SUCCEEDED',
        'CONFIRM_DECLINED',
        'CONFIRM_UNKNOWN',
        'CONVERGED',
        'EXPIRED',
        'CANCELED',
        'REOPENED_PAID',
        'FULFILLED',
        'REFUND_REQUESTED',
        'REFUND_SENT',
        'REFUND_SUCCEEDED',
        'REFUND_FAILED',
        'REFUND_UNKNOWN',
        'REFUND_REJECTED',
        'REFUND_WITHDRAWN',
        'REFUND_SYNCED',
        'REFUND_APPLIED',
        'REVIEW_FLAGGED',
        'TRANSACTION_FAILED',
      ].sort(),
    )
    expect(Object.keys(a.webhookStatus).sort()).toEqual([
      'DEAD',
      'FAILED',
      'IGNORED',
      'PROCESSED',
      'RECEIVED',
    ])
    expect(Object.keys(a.refundDialog.errors.declined).sort()).toEqual([
      'ALREADY_REFUNDED',
      'AMOUNT_EXCEEDED',
      'OTHER',
      'PARTIAL_NOT_ALLOWED',
      'PERIOD_EXPIRED',
      'TEMPORARY',
    ])
  })

  it('names the codes our backend writes on a refund line (failureCode) and the ones only the history carries (providerCode), each in its own table', () => {
    // 줄에 찍히는 코드 - 백엔드 `RefundSettlement` · `RefundLines` · 결제사 코드 없는 확정 거절(`REFUND_DECLINED`)
    expect(Object.keys(a.refundFailure).sort()).toEqual([
      'LATE_RESULT',
      'NOT_APPLIED',
      'ORDER_REFUNDED',
      'PROVIDER_PENDING',
      'REFUND_DECLINED',
      'RESULT_MISMATCH',
    ])
    // `PROVIDER_PENDING_EXPIRED` 는 줄에 안 찍히고 이력에만 남는다
    expect(Object.keys(a.eventCodes).sort()).toEqual(['LATE_RESULT', 'PROVIDER_PENDING_EXPIRED'])
    expect(Object.keys(defaultPaymentLabels.admin.refundFailure).sort()).toEqual(
      Object.keys(a.refundFailure).sort(),
    )
    expect(Object.keys(defaultPaymentLabels.admin.eventCodes).sort()).toEqual(
      Object.keys(a.eventCodes).sort(),
    )
  })

  it('a late provider answer is not read as "no refund": the line says money may have gone out and where to look', () => {
    expect(a.refundFailure.LATE_RESULT).toContain('닫힌 뒤에 결제사의 환불 결과가 도착했어요')
    expect(a.refundFailure.LATE_RESULT).toContain('환불된 금액을 확인해 주세요')
    expect(a.eventCodes.LATE_RESULT).toBe('닫힌 뒤에 결제사의 환불 결과가 도착했어요')
  })

  it('RESULT_MISMATCH does not claim the amount differed (a remaining-amount mismatch has the requested amount)', () => {
    expect(a.refundFailure.RESULT_MISMATCH).toBe('결제사의 답이 요청과 맞지 않았어요')
  })

  it('the provider still working is said in the present, with a table word', () => {
    expect(a.refundFailure.PROVIDER_PENDING).toBe('결제사에서 아직 환불 중이에요')
    expect(defaultPaymentLabels.admin.refundFailure.PROVIDER_PENDING).toBe(
      'The provider is still refunding',
    )
  })

  it('the Korean and English operator labels are not empty', () => {
    for (const labels of [koPaymentLabels, defaultPaymentLabels])
      for (const [path, text] of leaves(labels.admin))
        expect(text.trim().length, path).toBeGreaterThan(0)
  })
})

describe('resolvePaymentLabels', () => {
  it('overrides one nested label and keeps the rest', () => {
    const merged = resolvePaymentLabels({
      result: { paid: { title: 'Thanks for cheering!' } },
      orderStatus: { PAID: 'Done' },
    })
    expect(merged.result.paid.title).toBe('Thanks for cheering!')
    expect(merged.result.paid.description).toBe(defaultPaymentLabels.result.paid.description)
    expect(merged.orderStatus.PAID).toBe('Done')
    expect(merged.orderStatus.FAILED).toBe(defaultPaymentLabels.orderStatus.FAILED)
  })

  it('is the defaults when given nothing', () => {
    expect(resolvePaymentLabels()).toEqual(defaultPaymentLabels)
  })
})
