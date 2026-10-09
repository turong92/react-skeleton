/**
 * 결제 e2e 가 백엔드의 `SPRING_APPLICATION_JSON`(`skeleton.*`)에 얹는 값 — 시나리오가 기다릴 수 있는 시간 안에 끝나게 한다. 기본값(60초 · 30분)이면 시나리오 하나가 몇 분을 기다린다.
 * - `http.clients.payment-toss.response-timeout`: 결제사 응답 제한. 백엔드는 `reconcile.first-delay` 가 이 값보다 길지 않으면 기동에 실패한다(스펙 §9.2) — 모든 e2e 파일이 같은 백엔드를 쓰므로 이 값을 같이 싣는다. 장부를 쓰는 앱의 가드가 짧다고 경고하는 10초 밑으로 내리지 않는다.
 * - `payment.reconcile.first-delay`: 승인 선점 뒤 첫 조회 — 응답 제한(10초)보다 길게(11초).
 * - `payment.http.order-rate-limit`: 주문 만들기(`POST /payments/orders`)의 요청 수 한도 - 기본은 **계정마다 10 · 호출자 IP 마다 30 / 10분**(백엔드 `docs/config/modules/payment.yml`, 계약 9)이고, 넘으면 `429 COMMON.TOO_MANY_REQUESTS`.
 *   한 실행은 같은 계정(`user@example.com`)과 같은 주소(`::1`)에서 그보다 많은 주문을 만든다 - 이 백엔드에서만 넉넉히 푼다(운영 값이 아니다).
 * - `payment.webhook.path-token`: 웹훅 주소의 비밀 조각(`/payments/webhooks/toss/<token>`). 지금 어떤 시나리오도 웹훅을 보내지 않는다 - 보호 환경 규칙(24자 이상 · 서로 다른 글자 8개 이상 · 주소에 쓸 수 있는 글자만)을 지키는
 *   e2e 전용 값이라 비밀이 아니다(공개 저장소). 이후 시나리오가 웹훅을 보낼 때 이 값을 주소에 쓴다.
 * - `payment.checkout-ttl`: 결제 가능 시간 — 결제창에서 떠난 결제를 만료 작업이 이 시간 뒤 결제사에 물어 닫거나 맞춘다(시나리오 ②). 40초면 느린 첫 실행에서도 시나리오가 제 결제를 시간 안에 끝낸다.
 */
export const PAYMENT_E2E_SKELETON = {
  http: { clients: { 'payment-toss': { 'response-timeout': '10s' } } },
  payment: {
    'checkout-ttl': '40s',
    reconcile: { 'first-delay': '11s' },
    http: { 'order-rate-limit': { 'account-capacity': 1000, 'ip-capacity': 1000 } },
    webhook: { 'path-token': 'e2e-payment-webhook-token-0123456789' },
  },
} as const
