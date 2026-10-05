# @skeleton/payment

결제 **계약 타입 + 얇은 호출**. 의존: `@skeleton/api-client`.

## 한계를 먼저 — 이 패키지는 일부러 얇다

백엔드 `modules/payment`(`payment-toss` · `payment-stripe`)는 서비스 계약(`PaymentService` · `PaymentProvider` · `PaymentProviderRouter`)만 주고 **HTTP 엔드포인트를 열지 않는다**. 결제는 주문 · 금액 검증이 앱마다 달라 앱이 컨트롤러를 만든다. kotlin-skeleton 에 있는 유일한 HTTP 는 워크벤치의 라우팅 확인용 `GET /api/v1/skeleton/payments/route`(데모)다. 그래서:

- 재사용 가능한 REST 계약이 얇아 **결제 흐름(결제창 · 위젯 · 가상계좌)은 만들지 않았다** — 그건 제공자 SDK(토스 · 스트라이프)의 몫이고, 없는 흐름을 지어내지 않는다.
- 주는 것: Kotlin 계약과 1:1 인 **타입**, 앱이 연 경로를 부르는 **`createPaymentApi`**(기본 경로 없음), 토스 리다이렉트 → confirm 요청 **변환 한 개**, 결제 에러 코드 셋.

| 쓰는 것                                     | 백엔드                                                                                                                                        |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| confirm · cancel · refund 의 요청/응답 모양 | `modules/payment` `PaymentContracts.kt`(`PaymentConfirmRequest` · `PaymentCancelRequest` · `PaymentRefundRequest` · `PaymentOperationResult`) |
| 에러 코드                                   | `PaymentErrorCode` → `PAYMENT.PROVIDER_NOT_FOUND` · `PAYMENT.ROUTING_FAILED` · `PAYMENT.PROVIDER_ERROR`(502)                                  |
| 토스 리다이렉트 매핑                        | `payment-toss` `TossPaymentProvider.confirmBody`(`paymentKey` · `orderId` · `amount`)                                                         |
| 라우팅 확인(`route`)                        | **워크벤치 앱만**: `SkeletonPaymentController` `GET /skeleton/payments/route` — 모듈 계약이 아니다                                            |
| confirm · cancel · refund 의 **HTTP 경로**  | **없음** — 앱 컨트롤러가 `PaymentService` 를 불러 만든다. `createPaymentApi` 의 `paths` 로 알려 준다                                          |

## 쓰는 법

```ts
const payment = createPaymentApi(apiClient, {
  paths: { confirm: '/orders/pay/confirm', route: '/skeleton/payments/route' }, // 준 것만 생긴다
})

// 토스 결제창이 돌려보낸 successUrl 페이지에서
const request = confirmRequestFromTossRedirect(location.search, { currency: 'KRW' })
const done = await payment.confirm!(request, { idempotencyKey: newIdempotencyKey() }) // → PaymentOperationResult
if (done.status !== 'CONFIRMED') …                                                    // PENDING · FAILED · UNKNOWN 도 온다

// 에러 분기
try { … } catch (error) { if (isPaymentError(error)) … }
```

**금액 검증은 서버 몫이다.** 리다이렉트의 `amount` 는 주소에서 왔으므로 사용자가 고칠 수 있다 — 앱 컨트롤러가 주문의 실제 금액과 대조한 뒤 `PaymentService.confirm` 을 부른다. 이 패키지는 그것을 대신하지 않는다.

## 공개 표면

| export                                                            | 뜻                                                                                                                                                                                         |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `createPaymentApi(client, { paths })`                             | `route?(query)` · `confirm?(req, { idempotencyKey? })` · `cancel?` · `refund?` — `Idempotency-Key` 헤더는 앱이 idempotency 모듈을 켰을 때                                                  |
| `confirmRequestFromTossRedirect(search, { currency, provider? })` | `?paymentKey&orderId&amount` → `PaymentConfirmRequest`(`provider` 기본 `toss`). 빠지거나 숫자가 아니면 `PaymentRedirectError`                                                              |
| `isPaymentError(error)` · `PAYMENT_ERROR_CODES`                   | 결제 모듈 에러인가                                                                                                                                                                         |
| 타입                                                              | `PaymentAmount` `PaymentOperationStatus` `PaymentConfirmRequest` `PaymentCancelRequest` `PaymentRefundRequest` `PaymentOperationResult` `ProviderTrace` `PaymentRouteQuery` `PaymentRoute` |

## 테스트가 재지 않는 것

경로 · 본문 · 헤더, 토스 리다이렉트 변환, 에러 코드는 잰다. **재지 않는다**: 실제 백엔드 · 제공자 호출, 토스/스트라이프 결제창(SDK), 서버 쪽 금액 대조.
