import type { EasyPayCode } from './easyPay'
import type { ReviewReason, WebhookEventStatus } from './admin/types'
import type { OrderStatus, RefundRequestReason, RefundStatus } from './ledgerTypes'
import type { CatalogAdminLabels } from './labels.catalogAdmin'
import type { SubscriptionEndReason, SubscriptionStatus } from './subscriptionTypes'

/** 거절의 종류(`DECLINED` 의 `data.category`) — 모르는 값은 `OTHER` 문구 */
export type DeclineCategory = 'LIMIT_OR_BALANCE' | 'CARD_DECLINED' | 'TEMPORARY' | 'OTHER'

/** 환불 줄의 사유 — 본인이 고르는 셋과, 장부가 스스로 붙이는 셋(운영자가 한 환불 · 결제사 콘솔에서 일어난 환불 · 구매자가 카드사에 이의를 제기해 결제사가 돈을 가져간 차지백) */
export type RefundReasonCode = RefundRequestReason | 'OPERATOR' | 'PROVIDER_CONSOLE' | 'CHARGEBACK'

/** 운영자 환불이 거절(`REFUND_DECLINED`)될 때의 종류(`data.category`) — 모르는 값은 `OTHER` 문구 */
export type RefundDeclineCategory =
  | 'ALREADY_REFUNDED'
  | 'AMOUNT_EXCEEDED'
  | 'PARTIAL_NOT_ALLOWED'
  | 'PERIOD_EXPIRED'
  | 'TEMPORARY'
  | 'OTHER'

export type Titled = { title: string; description: string }

/** 운영자 목록 하나의 비었을 때 · 표 이름 */
type AdminListLabels = { caption: string; emptyTitle: string; emptyDescription: string }

/**
 * 운영자 부품(`@skeleton/payment/admin`)의 글자 — `PaymentLabels.admin`. 낱말 규칙은 사용자 부품과 같다(스펙 §11.2):
 * 돈을 돌려주는 일은 늘 「환불」(「승인」 · 「반려」 · 「취소」 없음), 결제사와 장부를 맞추는 일은 「결제사와 맞추기」(「동기화」 · 「대사」 없음).
 */
export type PaymentAdminLabels = {
  /** 확인 필요 사유 코드 → 글자 */
  reviewReason: Record<ReviewReason, string>
  /** 이 패키지가 모르는 사유 코드의 중립 글자 — 코드는 그리지 않는다 */
  reviewUnknown: string
  /** 확인 필요 띠 아래의 다음 걸음 안내 - 돈 쪽 사유(결제사에 다시 물어 맞춘다) */
  reviewHint: string
  /** 지급 · 회수가 끝내 안 된 사유(`FULFILMENT_UNRESOLVED` · `REFUND_APPLY_UNRESOLVED`)의 안내 - 「결제사와 맞추기」가 그 일을 다시 건다 */
  /** 쿠폰 충돌(`DISCOUNT_CONFLICT`) - 맞추기로는 안 풀린다는 것과 다음 걸음 */
  reviewHintDiscount: string
  reviewHintRetry: string
  /**
   * 「결제사와 맞추기」를 누른 **뒤에도** 사유가 남았을 때의 안내(돈 쪽 사유 · 오래 남은 확인 중 · 오래 남은 환불) - 오래 남은 것으로 파생된 사유는 맞춰도 안 풀릴 수 있다.
   * 같은 안내(「누르면 다시 물어봐요」)를 되풀이하지 않고 사실을 말한다
   */
  reviewHintSynced: string
  /** 맞춘 뒤에도 지급 · 회수 사유가 남았을 때 - 그 일을 다시 걸었고, 끝나면 스스로 사라진다 */
  reviewHintRetrySynced: string
  /** 계정이 지워진 결제의 표시(결제 목록 줄 · 한 건 화면의 계정 옆) */
  erasedAccount: string
  /**
   * 환불 **줄**에 찍히는 우리 쪽 이유 코드(`failureCode`) → 문장: `NOT_APPLIED` · `PROVIDER_PENDING` · `RESULT_MISMATCH` · `ORDER_REFUNDED` · `LATE_RESULT` ·
   * `REFUND_DECLINED`(결제사가 코드 없이 확정 거절). 모르는 코드는 코드 그대로 그린다
   */
  refundFailure: Record<string, string>
  /**
   * 서버에서 환불을 보낼 수 없는 이유(`refundBlock`) → 문장 - 환불 단추 옆에 이유 한 줄로 적는다. `OTHER` 는 모르는 값. 거절 단추는 막지 않는다(결제사 관리 화면에서 환불한 뒤 요청을 거절한다)
   */
  refundBlock: Record<'UNSUPPORTED' | 'PROVIDER_OFF' | 'MODE_MISMATCH' | 'OTHER', string>
  /**
   * **이력**에만 남는 이유 코드(`providerCode`) → 문장: `PROVIDER_PENDING_EXPIRED`(줄에는 안 찍힌다) · `LATE_RESULT`(이력 종류가 `REFUND_UNKNOWN` 이라 이력 이름이
   * 「결과를 몰라요」로 읽히니, 이 문장이 그 이름을 대신한다). 모르는 코드는 참조 번호에 그대로 둔다
   */
  eventCodes: Record<string, string>
  /** 이력 · 환불 줄의 행위자 */
  actors: Record<'USER' | 'OPERATOR' | 'SYSTEM' | 'PROVIDER', string>
  /** 이력 종류 코드 → 글자 */
  eventTypes: Record<string, string>
  /** 모르는 이력 종류의 중립 글자 */
  unknownEvent: string
  webhookStatus: Record<WebhookEventStatus, string>
  /** 세 목록이 함께 쓰는 오류 제목 — 불러오는 중 · 다시 불러오기 · 더 보기 · 오류 설명은 `list.*` 를 쓴다 */
  list: { errorTitle: string }
  orders: AdminListLabels & {
    /** 조건에 맞는 결제가 없을 때(찾는 중이라는 것을 말한다) */
    noMatchTitle: string
    noMatchDescription: string
    columns: { payment: string; amount: string; method: string; status: string; time: string }
    /** 조건 줄(`role="search"`)의 이름 */
    filterLabel: string
    statusFilter: string
    statusAll: string
    /** 「결제 방식」 필터 - 모두 · 결제 면제만 */
    settlementFilter: string
    settlementAll: string
    settlementExempt: string
    search: string
    searchHint: string
    searchSubmit: string
    /** 「탈퇴한 계정의 결제도 보기」 스위치 - 서버는 탈퇴한 계정의 결제를 기본으로 숨긴다 */
    includeErased: string
    /** 스위치 설명 - 확인 필요 탭과 결제 번호로 찾을 때는 늘 보인다는 것 */
    includeErasedHint: string
    details: string
    /** 단추의 낭독 이름 — 보이는 글자(`details`)로 시작한다 */
    detailsFor: (orderName: string) => string
  }
  /** 결제사 id → 경로 글자(「토스 경유」 · 「직접」) - 운영자 화면이 간편결제 앱 이름 옆에 붙인다. 모르는 id 는 id 그대로 */
  routes: Record<string, string>
  panel: {
    id: string
    account: string
    provider: string
    providerPayment: string
    /** 결제가 안 된 이유 코드 앞 이름(`ErrorReference` 의 말머리) */
    failureCode: string
    /** 직접 환불(전액 · 부분) 단추 */
    refund: string
    /** 환불 요청이 열려 있어 직접 환불이 막힌 이유 — 진행 중이면 `refundBlocked.inProgress` */
    refundBlockedByRequest: string
    /**
     * 다시 읽기가 실패해 화면이 낡았을 수 있다 - 돈이 나가는 단추(「환불하기」 · 「요청대로 환불하기」)가 막힌 이유.
     * 방금 환불이 나갔는데 화면이 환불 전 그대로일 수 있어, 최신 내용을 본 뒤에만 누르게 한다
     */
    stale: string
    /** 돈이 결제사와 어긋난 확인 필요(`REFUND_MISMATCH` …)라 먼저 맞추기를 권한다 - 돈이 나가는 단추(「환불하기」 · 「요청대로 환불하기」)가 막힌 이유(맞추기 단추가 있을 때) */
    syncFirst: string
    /** 같은 이유인데 화면에 「결제사와 맞추기」가 없다(`onSync` 없음) - 서버가 환불을 막는 사유(`REFUND_MISMATCH`)만 막고, 없는 단추로 보내지 않는다 */
    moneyOff: string
    /** 맞춘 뒤에도 돈이 어긋난 채다 - 방금 한 「결제사와 맞추기」를 또 하라고 하지 않고 결제사 화면을 보게 한다(`syncFirst` 대신) */
    stillOff: string
    /** 맞추기는 됐는데 방금 보낸 환불의 모름(잠금 · 키)을 못 놓았다 - 보낸 환불이 아직 가는 중일 수 있다. 몇 초 뒤에 다시 맞추면 되는지를 받는다 */
    syncHeld: string
    /** 방금 환불 호출이 성공했다고 말하는 상태 글자 - 금액을 받는다(재조회가 실패해도 이 말은 남는다) */
    refunded: (amount: string) => string
    /** 방금 환불이 나가는 중이다(`PENDING`) */
    refunding: (amount: string) => string
    sync: string
    syncing: string
    synced: string
    /** 막힌 구독 결제를 닫는 단추(확인 창을 연다) */
    closeCharge: string
    syncErrors: {
      unsupported: string
      unavailable: string
      /** 이 결제를 만든 키의 쪽(테스트 · 실제 결제)이 지금 키와 다르다 - 다시 해도 안 된다(409 `PAYMENT.MODE_MISMATCH`) */
      modeMismatch: string
      /** 결제사가 그 결제를 모른다(404 `PAYMENT.PROVIDER_PAYMENT_NOT_FOUND`) - 다시 건 일이 없다. 다시 해도 같다 */
      providerNotFound: string
      other: string
    }
    /** 요청 줄 옆 단추 — 보이는 글자와, 금액 · 결제 번호를 붙인 낭독 이름(줄마다 구별된다. 보이는 글자로 시작한다) */
    approve: string
    approveFor: (amount: string, orderId: string) => string
    reject: string
    rejectFor: (amount: string, orderId: string) => string
    events: string
    noEvents: string
  }
  /** 막힌 구독 결제를 「결제 안 됨」으로 닫는 확인 창 */
  closeChargeDialog: {
    title: string
    body: string
    confirm: string
    /** 확인 단추가 일하는 동안의 낭독 이름 */
    loading: string
    dismiss: string
    close: string
    errors: {
      /** 지금은 닫을 수 없다 - 결제사가 아직 진행하고 있거나 이미 정해졌다(409) */
      notClosable: string
      /** 주문 번호로 물을 수 없는 결제사 - 결제사 화면에서 직접 확인하고 확인 칸을 눌러야 닫는다(409) */
      needsConfirmation: string
      other: string
    }
    /** 확인 칸 이름 - 결제사 화면에서 이 결제가 없는 것을 직접 확인했다 */
    confirmedAtProvider: string
  }
  refundDialog: {
    direct: { title: string; note: string }
    approve: { title: string; note: string }
    reject: {
      title: string
      note: string
      confirm: string
      loading: string
      /** 서버가 답했고 거절이 안 된 경우(404 …) */
      error: string
      /** 답을 잃어 거절됐는지 모르는 경우 */
      unknown: string
    }
    confirm: string
    loading: string
    amountLabel: string
    /** 환불할 수 있는 금액 안내 — 금액을 받는다 */
    amountHint: (max: string) => string
    requestedAmount: string
    reason: string
    dismiss: string
    close: string
    /** 금액 칸이 막힌 이유(확인 단추 옆) — 고칠 수 있는 것은 칸의 오류로, 막힌 확인은 이 글자를 단추 설명으로 */
    blocked: {
      empty: string
      invalid: string
      zero: string
      exceeds: (max: string) => string
    }
    /** 구독 결제의 환불 창에서 「구독도 해지」 선택 - 기본 켜짐. `hint` 는 선택의 뜻(지금 기간 결제를 전액 환불할 때만 적용된다) */
    endSubscription: { label: string; hint: string }
    /** 결과를 모르는 동안 금액 · 사유 칸을 잠근 이유 한 줄 - 두 칸의 설명으로 이어진다. 같은 내용으로만 다시 보낼 수 있다 */
    locked: string
    /** 보내는 중에 금액 · 사유 칸을 잠근 이유 한 줄 - 두 칸의 설명이다. 보내는 동안 고친 값은 보낸 값이 아니다 */
    sending: string
    errors: {
      /** 409 `REFUND_UNSUPPORTED` - 그 결제사는 서버에서 환불할 수 없다. 결제사 관리 화면에서 환불한 뒤 요청을 거절한다 */
      unsupported: string
      /** 직접 환불이 지금은 안 된다(409) */
      notAllowed: string
      /** 직접 환불 · 승인의 409 `PAYMENT.MODE_MISMATCH` - 이 결제를 만든 키의 쪽(테스트 · 실제 결제)이 지금 키와 다르다. 다시 해도 안 된다 */
      modeMismatch: string
      /**
       * 요청 승인의 409 - 이미 결정됐을 수도, 주문이 환불할 수 없거나 결제사에 결제가 없을 수도 있다(두 뜻). 중립으로 말하고 결제 한 건으로 보낸다
       */
      approveNotAllowed: string
      /** 직접 환불의 409 `REFUND_IN_PROGRESS` 인데 열린 것이 기다리는 요청(`REQUESTED`)이다 - 「환불 중」이 아니다 */
      requestWaiting: string
      /** 요청 승인의 400 `REFUND_AMOUNT_EXCEEDED` - 요청 줄은 `REQUESTED` 로 남는다. 거절하거나 한 건에서 직접 환불 */
      approveExceeded: string
      amountExceeded: string
      /** 서버가 요청을 선점 전에 모양이 틀렸다고 거절했다(400 `COMMON.VALIDATION_FAILED` 등) - 아무것도 나가지 않았다. 금액과 사유를 고쳐 다시 보낼 수 있다 */
      invalid: string
      declined: Record<RefundDeclineCategory, string>
      /** 서버가 답했고 환불이 안 된 그 밖의 경우(404 …) */
      other: string
      /** 환불 전 확인 조회가 실패해 **보내지 않았다**(503 `PAYMENT.UNAVAILABLE`) — 확정이다, 아무것도 안 나갔다 */
      unavailable: string
      /** 답을 잃었다(네트워크 오류 · 시간 초과 · 5xx) — 환불이 나갔는지 모른다. 어디서 확인하는지 말한다 */
      unknown: string
      /** 답은 왔는데 환불 줄이 환불 없이 닫혀 있다(같은 키로 다시 보낸 답) */
      notDone: string
      /** 요청 승인 · 거절의 409 — 이미 결정됐거나 본인이 거뒀다 */
      alreadyDecided: string
      /** 요청 승인이 결제사 거절(402)로 끝났다 — 그 요청 줄은 닫혔다. 한 건에서 직접 환불로 안내 */
      requestClosed: string
    }
  }
  requests: AdminListLabels & {
    columns: {
      payment: string
      amount: string
      reason: string
      requestedAt: string
      status: string
    }
    details: string
    detailsFor: (orderId: string) => string
  }
  webhooks: AdminListLabels & {
    columns: {
      receivedAt: string
      event: string
      resource: string
      order: string
      status: string
      deliveries: string
      reason: string
    }
    /**
     * 표식 줄(`resourceType=LIMIT_MARKER`)이 이벤트 이름 자리에 쓰는 문장 - 한 결제의 알림이 창 상한에 걸려 창 끝에 조회 한 번으로 미뤄졌다(계약 8.2).
     * 이 줄은 결제사가 보낸 것이 아니라 우리가 만든 줄이다. 줄의 상태로 네 문장 - 아직 기다린다(`waiting`) · 확인이 끝났다(`done`) · 이번 시도가 안 돼 작업이 다시 한다(`retrying`) · 시도를 다 써 손이 필요하다(`failed`)
     */
    limitMarker: {
      /** 줄이 `RECEIVED` 다 - 창 끝에 도는 조회 한 번을 기다린다 */
      waiting: string
      /** 줄이 `PROCESSED` · `IGNORED` 로 끝났다 - 그 한 번의 조회가 끝났다 */
      done: string
      /** 줄이 `FAILED` 다 - 이번 시도가 안 됐고 작업이 다시 한다(계약 3 수신함). 사람에게 시키지 않는다 */
      retrying: string
      /** 줄이 `DEAD` 다 - 시도를 다 썼다. 다시 처리를 부탁한다 */
      failed: string
      /** 단추의 낭독 이름에 이벤트 이름 대신 쓰는 짧은 명사 */
      name: string
    }
    /**
     * 수신함 줄의 `resourceId` 가 `order:<주문 id>` 모양일 때 - 그 주문에는 결제사 결제 번호(결제 키)가 아직 없다.
     * 코드를 그대로 보이지 않고, 어느 결제인지(`orderId`)와 함께 풀어 쓴다
     */
    noProviderPayment: (orderId: string) => string
    retry: string
    /** 「다시 처리」를 보낸 줄에 남는 상태 글자(`role="status"`) - 목록이 다시 읽힐 때까지 */
    retried: string
    /** 단추의 낭독 이름 — 같은 이벤트 이름이 여러 줄이니 줄을 가르는 값(결제 번호, 없으면 결제사 결제 번호)을 붙인다 */
    retryFor: (eventType: string, target: string) => string
    retrying: string
  }
  /** 운영 카탈로그(상품 · 가격) 화면 */
  catalog: CatalogAdminLabels
}

/** 주기(`P1M` 등)의 단위 글자 — 개수를 받아 「월」(1) · 「3개월」처럼 돌려준다 */
export type PeriodUnitLabels = Record<
  'year' | 'month' | 'week' | 'day' | 'hour' | 'minute',
  (count: number) => string
>

/** 구독 부품(`SubscriptionPlanList` · `MySubscriptionCard` · `CancelSubscriptionDialog`)의 글자 */
export type SubscriptionLabels = {
  /** 구독 상태 알약 */
  status: Record<SubscriptionStatus, string>
  periodUnit: PeriodUnitLabels
  /** 「3,900원 · 1개월마다 결제」 - 금액 글자와 주기 단위 글자(`periodUnit`)를 받는다 */
  priceEvery: (money: string, unit: string) => string
  plans: {
    caption: string
    subscribe: string
    /** 단추의 낭독 이름 — 보이는 글자(`subscribe`)로 시작한다 */
    subscribeFor: (planName: string) => string
    /** 카드 등록 창을 여는 동안 단추 스피너의 낭독 이름 */
    subscribing: string
    emptyTitle: string
    emptyDescription: string
    /** 한 상품에 주기가 둘 이상일 때 카드 안 주기 단추 묶음의 이름 */
    intervalCaption: string
    /** 주기 단추의 글자 - 한 달 · 한 해 주기는 이 낱말, 그 밖(`P3M`)은 「3개월」 같은 주기 글자 */
    monthly: string
    yearly: string
    /** 행사가가 끝나는 날 안내(「11월 30일까지」) - 인자는 서식을 입힌 날짜 */
    saleUntil: (date: string) => string
    /** 취소선 정가 앞에 낭독 전용으로 붙는 말(「정가」) */
    regularPrice: string
  }
  mine: {
    amount: string
    nextPayment: string
    /** 해지 예약 중 이용이 끝나는 때 칸의 이름 */
    access: string
    /** 「11월 1일에 끝나요」 - 인자는 이미 서식을 입힌 시각 */
    endsOn: (when: string) => string
    card: string
    recentPayments: string
    cancel: string
    /** 「지금 해지하고 환불」 단추 - 이 나라의 정책이 중도 해지를 열었을 때만 보인다 */
    cancelNow: string
    /** 「플랜 올리기」 단추 */
    changePlan: string
    /** 예약된 플랜 변경 칸의 이름 */
    scheduled: string
    /** 「11월 1일부터 Basic · 3,900원 · 1개월마다 결제」 - 인자는 서식을 입힌 날짜와 플랜 이름, 금액 글자 */
    scheduledValue: (when: string, planName: string, price: string) => string
    /** 예약된 변경을 거두는 단추 */
    withdrawSchedule: string
    /** 플랜 변경의 결제를 결제사가 아직 답하지 않았다(`pendingPlanCode`) */
    changePending: string
    /** 첫 결제를 결제사가 아직 답하지 않았다(`PENDING`) */
    pending: string
    /** 갱신이 거절돼 다시 시도하는 중(`PAST_DUE`) - 그동안은 이용할 수 없다 */
    pastDue: string
    /** 끝난 구독(`ENDED`)의 안내 - 끝난 이유별 */
    ended: Record<SubscriptionEndReason, string>
    /** 이 패키지가 모르는 끝난 이유 */
    endedUnknown: string
  }
  cancelDialog: {
    title: string
    /** 기간 끝까지 이용하고 그 뒤 결제하지 않는다 - 인자는 이미 서식을 입힌 끝나는 시각 */
    body: (when: string) => string
    /** `PAST_DUE` 는 해지하면 바로 끝난다 */
    bodyNow: string
    confirm: string
    /** 확인 단추가 일하는 동안의 낭독 이름 */
    loading: string
    /** 창을 닫는 단추 - 「취소」가 결제 취소로 읽히지 않게 「닫기」 */
    dismiss: string
    /** 모서리의 × 단추의 낭독 이름 */
    close: string
    error: string
  }
  cancelScheduleDialog: {
    title: string
    /** 예약된 플랜과 바뀌는 날(서식을 입힌 글자)을 말하고, 거두면 지금 플랜 그대로라고 한다 */
    body: (planName: string, when: string) => string
    confirm: string
    /** 확인 단추가 일하는 동안의 낭독 이름 */
    loading: string
    dismiss: string
    close: string
    error: string
  }
  cancelNowDialog: {
    title: string
    /** 지금 바로 끝나고 이용할 수 없다 + 쓰지 않은 만큼 돌려준다 */
    body: string
    /** 계산 내역 표의 낭독 이름 */
    breakdown: string
    paid: string
    used: string
    penalty: string
    /** 환불 예정 금액 칸의 이름 */
    refund: string
    /** 철회 기간 안이라 전액 환불 */
    withdrawal: string
    /** 금액은 해지하는 순간 기준으로 다시 계산된다 */
    estimate: string
    /** 낼 돈이 없어 돌려줄 금액이 0 이다 */
    noRefund: string
    loadingPreview: string
    previewError: string
    confirm: string
    /** 확인 단추가 일하는 동안의 낭독 이름 */
    loading: string
    /** 창을 닫는 단추 - 「취소」가 결제 취소로 읽히지 않게 「닫기」 */
    dismiss: string
    /** 모서리의 × 단추의 낭독 이름 */
    close: string
    errors: {
      notAllowed: string
      /** 갱신 · 변경 결제가 오가는 중 - 끝난 뒤 다시 */
      chargeInProgress: string
      other: string
    }
  }
  /** 지금 해지한 직후 안내 띠 - 인자는 이미 서식을 입힌 금액 */
  cancelNowResult: {
    done: (refund: string) => string
    noRefund: string
    /** 환불을 결제사가 처리 중이거나 서버가 다시 보낼 것이다 */
    pending: string
    /** 결제사가 환불을 거절했다 - 사람이 본다 */
    failed: string
  }
  changeDialog: {
    title: string
    plan: string
    /** 지금 결제될 금액 칸의 이름 */
    chargeNow: string
    /** 지금 결제할 금액이 0 이라 과금 없이 바뀐다 */
    noCharge: string
    /** 새 플랜의 다음 결제 칸의 이름 - 값은 「6,900원 · 1개월마다 결제」 */
    nextPrice: string
    /** 전액을 결제하고 오늘부터 새 기간이 시작된다(남은 이용분을 깎아 주지 않는 변경) */
    restart: string
    /** 오늘부터 새 결제 주기가 시작되고 지금 주기의 남은 이용분을 빼고 결제된다 - 인자는 서식을 입힌 공제액과 결제할 금액 */
    restartCredit: (credit: string, charge: string) => string
    /** 이미 예약된 변경이 있는데 바로 바꾸면 그 예약이 사라진다 - 인자는 예약된 플랜 이름과 서식을 입힌 날짜 */
    clearsSchedule: (planName: string, when: string) => string
    /** 이미 예약된 변경이 있는데 다른 예약을 하면 덮어쓴다 */
    replacesSchedule: (planName: string, when: string) => string
    /** 선택지 묶음의 이름 - 바로 바뀌는 플랜 / 다음 결제일부터 바뀌는 플랜 */
    groups: { now: string; next: string }
    /** 예약 미리보기의 「바뀌는 날」 칸의 이름 */
    effectiveOn: string
    /** 예약이라 지금 결제는 없다 */
    scheduledNote: string
    /** 예약일 때 확인 단추 */
    confirmScheduled: string
    loadingPreview: string
    previewError: string
    /** 결제사가 올리기만 받는 구독에 낮은 플랜 · 짧은 주기를 골라 미리보기 · 변경이 409 `PLAN_CHANGE_DOWNGRADE_UNSUPPORTED` 로 거절됐다 - 이유를 말한다 */
    previewDowngradeUnsupported: string
    /** 미리보기가 503 `UNAVAILABLE` - 결제사에 그 플랜의 가격이 아직 없다 */
    previewUnavailable: string
    confirm: string
    /** 확인 단추가 일하는 동안의 낭독 이름 */
    loading: string
    /** 창을 닫는 단추 - 「취소」가 결제 취소로 읽히지 않게 「닫기」 */
    dismiss: string
    /** 모서리의 × 단추의 낭독 이름 */
    close: string
    errors: {
      /** 그 사이 금액이 올랐다 - 새 미리보기를 보고 다시 누른다 */
      chargeChanged: string
      /** 카드 결제가 되지 않았다 - 플랜은 그대로 */
      declined: string
      notAllowed: string
      other: string
    }
  }
}

/**
 * 결제 부품이 그리는 글자 전부 — 부품은 번역을 모른다. 기본은 영어(`labels.en.ts`)이고 한국어는 `koPaymentLabels`(`labels.ko.ts`).
 * 일부만 덮어쓰려면 `labels={{ result: { paid: { title: '응원해 주셔서 고마워요' } } }}`(안쪽도 일부만 가능).
 * 낱말은 한 벌로 통일한다(결제 · 환불 · 결제 확인 중 …) — 「쓰지 않는 말」이 문구에 없는 것은 `labels.test.ts` 가 지킨다.
 * 화면 낭독이 읽는 글자(스피너 · 오류 말머리 · 닫기 단추)도 여기 있다 — 한국어 문구를 넘기면 영어가 남지 않는다.
 */
export type PaymentLabels = {
  /** 안내 띠(`TestModeNotice`)의 낭독 말머리 */
  noticeLabel: string
  /** 「테스트 결제예요. 실제로 돈이 나가지 않아요」 */
  testMode: string
  /** 결제창 안 간편결제 단추 묶음(`EasyPayButtons`) - 낭독 이름과 단추 글자(결제사가 부르는 이름) */
  easyPay: { group: string; names: Record<EasyPayCode, string> }
  orderStatus: Record<OrderStatus, string>
  /** 열린 환불이 있는 동안(`PENDING`) 상태 알약 자리에 대신 보이는 글자. `REQUESTED` 는 `refundStatus.REQUESTED` */
  refundInProgress: string
  refundStatus: Record<RefundStatus, string>
  /** `WITHDRAWN` 줄을 시스템이 닫았을 때(`closedBy: 'SYSTEM'` - 환불이 끝나 요청이 닫혔다) 알약 글자 - 본인이 거둔 줄은 `refundStatus.WITHDRAWN` */
  refundClosedBySystem: string
  /** 이 패키지가 아직 모르는 상태 코드의 중립 글자 — 코드는 화면에 그리지 않는다. 확인 필요한 결제의 알약(운영자 부품)도 같은 글자 */
  unknownStatus: string
  /** 오류 알림(`Alert`)의 낭독 말머리 */
  errorLabel: string
  /** 환불 사유 코드 → 글자. 모르는 코드는 글자 없이 둔다 */
  refundReason: Record<RefundReasonCode, string>
  /** 결제 수단 종류 코드(`CARD` · `EASY_PAY` …) → 글자. 모르는 코드는 보이지 않는다 */
  methods: Record<string, string>
  /** 결제사가 직접 받은 간편결제의 브랜드 코드(`KAKAOPAY` · `NAVERPAY`) → 앱 이름. 모르는 코드는 `methods.EASY_PAY` */
  easyPayBrands: Record<string, string>
  /** 카드사 코드(`HYUNDAI` …) → 이름. 모르는 코드는 `cardFallback` */
  issuers: Record<string, string>
  cardFallback: string
  /** 통화 → 금액 뒤에 붙는 글자(`KRW: '원'` → 3,000원). 빈 글자나 없는 통화는 `Intl` 의 통화 표기 */
  currencySuffix: Record<string, string>
  failure: Record<DeclineCategory, string>
  list: {
    caption: string
    emptyTitle: string
    emptyDescription: string
    /** 스피너의 낭독 이름 — 「더 보기」 단추가 일하는 동안에도 이것 */
    loading: string
    errorTitle: string
    errorDescription: string
    retry: string
    details: string
    /** 단추의 낭독 이름 — 보이는 글자(`details`)로 시작한다 */
    detailsFor: (orderName: string) => string
    loadMore: string
  }
  result: {
    paid: Titled
    /** 환불이 끝난 결제 */
    refunded: Titled
    confirming: Titled & { loading: string }
    slow: Titled
    failed: { title: string }
    /** 서버가 이 승인 요청을 받지 않았고(400 · 409 · 404) 주문도 끝나지 않았다 — 돈이 나갔는지는 결제 내역이 말한다 */
    unconfirmed: Titled
    expired: Titled
    canceled: Titled
    viewHistory: string
    retry: string
  }
  summary: {
    /** 주문 이름(`orderName`) 칸의 이름 */
    name: string
    amount: string
    method: string
    paidAt: string
    refunded: string
    refundable: string
    refunds: string
    requestRefund: string
    /** 내 환불 요청(`REQUESTED`) 줄 옆의 단추와, 그 단추가 일하는 동안의 낭독 이름 */
    withdrawRefund: string
    withdrawing: string
    /** 운영자가 금액을 고쳐 환불했을 때 환불 금액 옆에 붙는 처음 요청한 금액 - 「요청 5,000원」. 인자는 서식을 입힌 금액 */
    requestedAmountNote: (requested: string) => string
  }
  /** 환불 요청이 막힌 이유 — 단추 옆 글자와 환불 창의 오류가 같은 문장을 쓴다 */
  refundBlocked: {
    /** 이미 환불을 요청해 둔 상태(`REQUESTED`) */
    requested: string
    /** 환불이 진행 중(`PENDING`) */
    inProgress: string
    unavailable: string
    /** 다시 읽기가 실패해 화면이 낡았을 수 있다 - 최신 내용을 본 뒤에 요청하게 */
    stale: string
  }
  refundDialog: {
    title: string
    amountLabel: string
    note: string
    reason: string
    confirm: string
    /** 확인 단추가 일하는 동안의 낭독 이름 */
    loading: string
    /** 창을 닫는 단추 — 「취소」가 결제 취소로 읽히지 않게 「닫기」 */
    dismiss: string
    /** 모서리의 × 단추의 낭독 이름 */
    close: string
    /** 환불할 수 있는 금액이 0 일 때 */
    nothingToRefund: string
    errors: {
      /** 든 키로 다시 보냈더니 그 요청 줄이 이미 거절 · 거둠으로 닫혀 있다 - 키가 놓였으니 다음 누름은 새 요청이다 */
      closed: string
      other: string
    }
  }
  reference: { label: string; copy: string; copied: string }
  /** 할인 · 정산(쿠폰으로 0원 · 결제 면제) 표시 */
  discount: {
    /** 금액 줄 이름 - 할인 전 · 할인 뒤(최종) */
    original: string
    final: string
    /** 정산 알약: 쿠폰으로 0원 · 결제 면제 (결제사가 받은 보통 결제에는 없다) */
    settlement: { FREE: string; EXEMPT: string }
    /** 결제 결과 화면의 설명 - 결제창 없이 끝난 이유 */
    settledNote: { FREE: string; EXEMPT: string }
    /** 구독 카드 칸 이름 · 「다음 결제 3,450원(할인 2회 남음)」 - 남은 횟수가 null 이면 영원한 할인 */
    subscriptionDiscount: string
    nextPayment: (amount: string, remaining: number | null) => string
    /** `PAYMENT.DISCOUNT_*` · `PAYMENT.NOTHING_TO_REFUND` 오류 문장 */
    errors: {
      notApplicable: string
      unavailable: string
      notSupported: string
      belowMinimum: string
      nothingToRefund: string
    }
  }
  subscription: SubscriptionLabels
  admin: PaymentAdminLabels
}

export type DeepPartial<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T

export type PaymentLabelsInput = DeepPartial<PaymentLabels>
