# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added — 네이버페이 직접 연동 (단건 결제 · 취소 · 환불) — 토스 계약 없이

- `checkout.kind === 'NAVERPAY_REDIRECT'`: 서버가 결제를 이미 예약했다(금액 · 주문 번호는 장부의 값 - 구매자가 못 바꾼다). `openCheckout` 이 SDK 없이 구매자를 서버가 준 결제창 주소(`attributes.windowUrl`, http(s) 절대 주소만 - 아니면 던진다)로 보낸다(`navigate` 로 바꿀 수 있다). 간편결제 단추가 따로 없어 `easyPay` 를 주면 던진다. `checkoutCanOpen` 이 이 결제창도 가른다(공개 키가 `null` 인 것이 정상).
- `readNaverPayReturn(search)`: 서버 설정의 돌아올 주소로 붙어 온 `?kind=NAVERPAY_REDIRECT&order=…&resultCode=Success&paymentId=…` / `resultCode=UserCancel` / 그 밖의 `resultCode` 를 읽는다(금액은 주소에 없다). 승인은 토스처럼 `confirmOrder(id, { providerPaymentId: paymentId, amount })`. 백엔드 `payment-naverpay`. 견본 `PaymentReturnPage` 는 읽은 주문의 금액과 결제 번호로 승인을 한 번 보내고, `CheerPage` 의 「결제 방법」 고르기에 네이버페이가 나온다. e2e: 가짜 네이버페이 `apps/sample/e2e/fakeNaverPay.ts` + `naverpay.e2e.ts`. 인증값이 가맹 심사 뒤에야 나와 진짜 네이버페이로는 돌려 보지 못했다.

### Added — 카카오페이 직접 연동 (단건 결제 · 취소 · 환불) — 토스 계약 없이

- `checkout.kind === 'KAKAOPAY_REDIRECT'`: `openCheckout` 이 SDK 없이 구매자를 서버가 준 결제창 주소(`attributes.pcUrl` · `mobileUrl`, http(s) 절대 주소만 - 아니면 던진다)로 보낸다(`navigate` · `isMobile` 로 바꿀 수 있다). 카카오페이에는 간편결제 단추가 따로 없어 `easyPay` 를 주면 던진다. `checkoutCanOpen(checkout)`: 열 수 있는 결제창인가(토스 · Paddle = 공개 키, 카카오페이 = 결제창 주소 - 공개 키가 `null` 인 것이 정상이다).
- `readKakaoPayReturn(search)`: 서버 설정의 돌아올 주소로 붙어 온 `?provider=kakaopay&order=…&result=success|cancel|fail&pg_token=…` 을 읽는다(금액도 결제 번호도 주소에 없다). `ConfirmOrderInput` 에 `approvalToken`(= `pg_token`)이 생기고 `providerPaymentId` 는 선택이다(서버가 주문에 박아 둔 거래 번호를 쓴다). 백엔드 `payment-kakaopay`.
- `PaymentConfig.choices`(같은 나라에서 열린 결제사 - 둘 이상이면 화면이 「결제 방법」을 고르게 한다) · `CreateOrderInput.provider`(고른 결제사 - 서버는 `choices` 안에서만 받는다). 같은 항목에 다른 결제사를 고르면 다른 의도라 `Idempotency-Key` 도 다르다. 견본 `CheerPage` 가 쓰고(토스 + 카카오페이가 둘 다 켜진 서버에서만 고르기가 보인다), 돌아온 화면(`PaymentReturnPage`)은 읽은 주문의 금액과 토큰으로 승인을 한 번 보낸다. e2e: 가짜 카카오페이 `apps/sample/e2e/fakeKakaoPay.ts` + `kakaopay.e2e.ts`.

### Added — 간편결제 단추 (토스 결제창 안 네이버페이 · 카카오페이 · 토스페이)

- `EasyPayButtons`(카드 단추 옆 테두리 단추 하나씩, 막힘은 `ariaDisabled` + `describedBy`, 누른 단추에만 스피너) · `easyPaysFor(config, provider)` · `EASY_PAY_CODES` · 라벨 `easyPay`(ko/en) · `PaymentConfig.easyPays`(백엔드 `GET /config`, 결제사 id → 코드 목록).
- `openCheckout(checkout, { easyPay })`: 토스 SDK 에 `card: { flowMode: 'DIRECT', easyPay }` 로 그 앱을 바로 연다. 그 주문의 `checkout.attributes.easyPays` 에 없는 코드(그리고 Paddle 결제창)는 SDK 를 불러오기 전에 던진다.
- 단건 결제 전용 - 자동결제(`openBillingAuth`) 카드 등록 창엔 간편결제가 없어 구독 화면에는 내지 않는다. 서버 목록이 비면 화면은 예전 그대로. 견본 `CheerPage` 가 쓴다. 백엔드: `skeleton.payment-toss.easy-pays`.

### Fixed — Paddle 결제 직후 화면이 옛 구독에서 멈추던 것

- `useMySubscription(api, { subscriptionId })` — 방금 시작한 구독의 id 가 보이고 `PENDING` 을 벗어날 때까지 되묻는다. 같은 계정의 옛 `ENDED` 구독이 먼저 읽혀도 답으로 치지 않는다(해지 후 재구독 · 같은 계정으로 연달아 도는 e2e 에서 화면이 「없음」에 멈추던 구멍). 견본 `SubscriptionReturnPage` 가 반환 주소의 구독 id 를 넘긴다. `untilActive: true` 만 쓰던 호출은 그대로. 토스 구독(`activate` 응답 · id 일치)과 단건 주문(`orderQuery` 가 id 로 조회)은 이미 같은 구멍이 없다.

### Added — 한 서버에 프로젝트 여럿 (개발 · 정적 빌드 · 서버 렌더)

백엔드가 요청 Host 로 프로젝트를 고르는 구성(`docs/multi-project.md`)에 맞췄다. 설정이 없으면 지금과 같다.

- 개발: `apps/sample/devProxy.ts` — `<이름>.localhost` 로 열면 그 Host 가 `/api/v1` 프록시를 지나 백엔드까지 그대로(+ `X-Forwarded-Host`). `localhost` · IP · 터널은 예전 그대로.
- 정적: `vite build --mode <프로젝트>` 가 `.env.<프로젝트>` 로 프로젝트별 산출물을 낸다. API 의 https 공개 주소가 프로젝트 자신의 값으로 없으면 빌드가 멈춘다(`projectBuild.ts`). Pages 설정은 문서에.
- 서버 렌더: `apps/starter-ssr` 에 `PROJECTS_FILE` — 한 Node 서버가 Host 로 프로젝트별 번들을 골라 그린다(목록 밖 Host 421 · `/healthz` 는 Host 무관 · `/assets` Host 별 · 백엔드 호출에 `X-Forwarded-Host`). 프로젝트 빌드는 `pnpm --filter starter-ssr build:project <이름>`. 루트 `tests/ssr.safety.test.ts` 에 프로젝트·요청 사이 누출 검사.

### Changed — 결제사 · 나라는 서버가 정한다

- `PaymentConfig` 에 `country` · `provider` · `cancelPolicy`(`PaymentCancelPolicy`). `StartSubscriptionInput` · `CreateOrderInput` 에서 `country` · `provider` 를 뺐다(서버가 접속 나라로 정하고 본문 값은 읽지 않는다). 운영자 라벨에 `BUYER_COUNTRY_KR`.
- 견본 앱: 「나라 고르기」 칸과 `chooseProvider`/`VITE_PAYMENT_PROVIDER` 를 없애고 `CountryPolicyNotice`(결제 국가 + 그 나라의 해지·환불 규칙 두세 줄 + 환불 정책 링크, 보여 주기 전용)로 바꿨다. e2e 는 컨텍스트의 `CF-IPCountry` 헤더로 나라를 정한다. `capabilities.json` 에 `payment-paddle` 을 맞췄다.

### Added — 운영자의 막힌 구독 결제 닫기(`@skeleton/payment/admin`)

백엔드 `POST /admin/payments/orders/{id}/close`(HTTP 계약)에 맞췄다.

- `closeSubscriptionCharge` · `useCloseSubscriptionCharge`, `AdminOrderPanel` 의 `onCloseCharge`(확인 중으로 남은 구독 결제에만 「결제 안 됨으로 닫기」), `CloseSubscriptionChargeDialog`. 주문의 `kind` 에 `SUBSCRIPTION_CHANGE`.

### Added — 환불 요청을 운영자가 금액 고쳐 승인(`@skeleton/payment/admin`)

백엔드 `POST /admin/payments/refunds/{id}/approve` 의 선택 본문 `{amount}`(HTTP 계약)에 맞췄다. 금액을 고치지 않으면 지금과 같다(본문 없이 요청 금액 그대로).

- `approveRefund(id, amount?)` · `useApproveRefund` 변수 `{ id, amount }`(문자열 id 도 그대로 받는다) · 환불 줄의 `requestedAmount`.
- `AdminRefundDialog` 승인 모드에 금액 칸(요청 금액에서 시작, 상한 = 요청 금액과 환불 가능액 중 작은 쪽) — `onConfirm(amount?)`. 환불 줄 옆에 금액이 다르면 「요청 5,000원」(`requestedAmountNote`): 운영자 목록 · 한 건 · 내 결제 상세.

### Added — 구독 플랜 올리기(`@skeleton/payment` · `apps/sample`)

백엔드 `skeleton.payment.subscription.plan-change.enabled=true`(HTTP 계약 §12.2)에 맞췄다.

- `createSubscriptionApi` 에 `changePreview`(지금 결제될 금액) · `changePlan`(`Idempotency-Key`, 긴 제한 시간), 훅 `usePlanChangePreview` · `useChangeSubscriptionPlan`(결과를 모르면 같은 키로 다시, 확정된 거절 뒤에는 새 키), 구독의 `pendingPlanCode`(결제 확인 중이면 `useMySubscription` 이 되묻는다), 오류 코드 `PLAN_CHANGE_NOT_ALLOWED` · `PLAN_CHANGE_CHARGE_CHANGED` · `ORDER_NOT_CLOSABLE`.
- `ChangePlanDialog`(플랜 고르기 → 지금 결제될 금액 미리보기 → 확인) 와 `MySubscriptionCard` 의 `onChangePlan`(채운 「플랜 올리기」, 해지 예약은 테두리로 물러난다). 문구는 `labels.subscription.changeDialog`(ko · en). 견본 「내 구독」이 윗등급 플랜이 있을 때 연다.

### Added — 구독(자동결제) 화면과 호출(`@skeleton/payment` · `apps/sample`)

백엔드 `skeleton.payment.subscription.enabled=true`(HTTP 계약 §12)에 맞췄다. 꺼진 서버에서는 경로가 없으니 이 부분을 쓰지 않으면 아무것도 바뀌지 않는다. 쓰는 법은 `packages/payment/README.md` 의 「구독」.

- **호출 · 훅** — `createSubscriptionApi`(플랜 · 시작(`Idempotency-Key`) · 첫 결제 `activate`(승인과 같은 긴 제한 시간) · 내 구독 · 해지) · `useSubscriptionPlans` · `useMySubscription`(첫 결제를 확인하는 `PENDING` 동안만 `useOrder` 와 같은 간격으로 되묻는다) · `useStartSubscription` · `useActivateSubscription`(결과를 모르면 알아서 다시 보낸다) · `useCancelSubscription`. 변경은 `paymentKeys.all` 을 무효화한다(`start` 는 제외). `openBillingAuth`(토스 카드 등록 창 · SDK 로더는 `openCheckout` 과 같다; `TossPaymentsFactory` 에 `requestBillingAuth`) · `readBillingReturn`.
- **오류 코드 4개** — `SUBSCRIPTION_NOT_FOUND` · `ALREADY_SUBSCRIBED` · `SUBSCRIPTION_NOT_ACTIVATABLE` · `SUBSCRIPTION_NOT_CANCELABLE` (`PAYMENT_LEDGER_ERROR_CODES` 가 열여섯에서 스물). `Order.kind` 에 `SUBSCRIPTION_INITIAL` · `SUBSCRIPTION_RENEWAL`.
- **화면 부품** — `SubscriptionPlanList` · `SubscriptionStatusBadge` · `MySubscriptionCard` · `CancelSubscriptionDialog`, 도우미 `priceEveryDisplay`. 문구는 `PaymentLabels.subscription`(ko · en) 한 묶음이 늘었다 - 앱이 `PaymentLabels` 를 통째로 만들어 넘기던 곳은 이 키가 필요하다. 스토리 `Packages/payment/SubscriptionPlanList` · `MySubscriptionCard` · `CancelSubscriptionDialog`.
- **sample** — 메뉴 「구독」(`/subscription`, 내 구독) · `/subscribe`(플랜 카드 → 카드 등록 창) · `/subscriptions/return`(돌아온 `authKey` 로 첫 결제를 한 번만 보내고 `PaymentResult` 로 보인다). 플랜 이름은 코드로 된 번역(`subscription.plan.basic` 등)이 있으면 그것을, 없으면 서버 이름을 쓴다. 설정 화면은 그대로다.

### Changed — 설정은 카드 3장 · 항목 한 줄씩(`@skeleton/auth` · `@skeleton/ui` · `@skeleton/legal` · `apps/sample`)

- **설정(`/account`)이 카드 9장에서 3장(계정 · 로그인 · 보안 · 환경)이 되고, 카드 안은 항목 한 줄씩이다**(이름 · 현재 값 · 오른쪽 테두리 단추; 375 · 320px 에서는 이름이 위, 값과 단추가 아래 줄). 긴 설명은 그 항목의 대화상자 안으로 옮겼고, 로그인 수단 · 로그인한 기기 · 약관 동의는 목록이 줄에 펼쳐져 있지 않고 「관리」 · 「보기」가 여는 대화상자 안에 있다. 구역 칩과 `#email` 같은 해시는 그 항목이 든 카드로 간다. 제공자 왕복 뒤 재개(연결 · 해제)는 로그인 수단 대화상자를 다시 열어 결과를 그 안에 보인다.
- **새 부품**: `@skeleton/ui` 의 `SettingsGroup`(카드 한 장) · `SettingsRow`(한 줄 — `role="group"` 에 이름, 줄의 대화상자는 `dialogs` 로 줄 안에 둔다). 구역 부품(`ProfileSection` · `PasswordSection` · `EmailSection` · `ContactEmailSection` · `SignInMethodsSection` · `SessionsSection` · `DeleteAccountSection` · `LoginIdSection` · `NeedsEmailCard`)의 이름은 그대로고 `row` prop 이 줄만 그리게 한다(없으면 제목 있는 카드 한 장에 그 줄 하나). `SessionsSection` · `SignInMethodsSection` · `ProfileSection` 의 `initiallyOpen`(서버 렌더 시험 · 스토리용).
- **`AccountSettings` 의 `preferenceRows`**(`createAuthRoutes({ settings })` 도 받는다) — 「환경」 카드에 더할 줄. 견본 앱은 `after`(설정 아래에 이어 붙임) 대신 `<ConsentSettings row />` 를 여기에 건다. `@skeleton/legal` 의 `ConsentSettings` 는 `row` 이면 「약관 동의」 줄 + 「보기」 대화상자.
- **`AuthLabels` 키 10개 추가**: `groupAccount` · `groupSecurity` · `groupPreferences` · `rowChange` · `rowManage` · `rowView` · `rowRegister` · `rowNone` · `sessionsCount`.

### Changed — 설정의 입력은 대화상자로(`@skeleton/auth` · `@skeleton/ui` · `apps/sample`)

- **설정 구역은 현재 값 + 단추만 보이고, 입력 양식은 모달 대화상자로 뜬다**(프로필 · 계정 이메일 · 연락받을 이메일 · 비밀번호 · 계정 삭제). 세션 로그아웃 · 연락받을 이메일 지우기에는 확인 단계가 생겼다. 제공자 왕복에서 돌아오면 그 구역으로 스크롤하고 같은 대화상자가 그 단계로 다시 열린다. 새로고침 뒤 대기 중인 이메일 변경은 구역의 「인증번호 입력 이어 하기」 단추로 보인다(팝업이 저절로 뜨지 않는다).
- **`AuthLabels` 키 11개 추가**(앱이 문구를 덮어쓴 경우 확인): `profileEdit` · `dialogClose` · `passwordHasValue` · `passwordHasNone` · `emailContinueCode` · `contactEmailRemoveTitle` · `contactEmailRemoveBody` · `sessionsRevokeTitle` · `sessionsRevokeBody` · `sessionsRevokeOthersTitle` · `sessionsRevokeOthersBody`.
- **새 prop**: `EmailSection` 의 `initiallyOpen` · `resumeFailure`, `PasswordSection` 의 `initiallyOpen`, `SignInMethodsSection` 의 `failure`.
- **`AppShell` 이 고정 머리의 실제 높이를 문서의 `scroll-padding-top` 으로 쓴다** — 구역 칩 · 앵커로 가도 제목이 머리 밑에 깔리지 않는다.
- **로그인 수단 구역은 이메일 없는 계정에게도 열린다**(백엔드 `feat/link-without-email` 이 먼저 배포돼야 한다 — 소셜 연결 · 해제를 쓰기 때 방식의 허용 목록에 더했다).
- **제공자 재확인(1시간 뒤 첫 이메일 등록)에서 돌아오면 떠나기 전의 같은 주소로 와 막이 다시 열리고 인증번호 요청까지 이어 간다**(`8760ad0`).
- 견본 앱: 운영자(`ADMIN`) 계정에게만 상단 메뉴에 「결제 관리」 「계정 관리」가 보인다.

### Added — 로그인 아이디(서버가 켠 앱만) · 이메일을 「쓰기 때」 받기(`@skeleton/auth` · `@skeleton/auth/admin` · `apps/sample`)

백엔드(kotlin-skeleton, `docs/account-http-contract.md` 의 **FINAL-7** — 로그인 아이디 L1~L13, 쓰기 때 이메일 E7~E12)에 맞췄다. 둘 다 앱의 선택이라 **기본은 꺼짐**이고, 켜졌는지는 응답이 말한다: `GET /auth/methods` 의 `loginId: { minLength, maxLength }` 키(발견) · `me.loginId`(`null` = 정해야 한다, 키 없음 = 꺼진 서버) · `me.emailRequired` / `me.emailRequiredToWrite`. **키가 없으면 모든 화면이 예전과 같다**(앱이 환경변수로 따로 맞추는 값은 없다). 쓰는 법은 `packages/auth/README.md` 의 「로그인 아이디」 · 「이메일을 받는 시점」 · 「막 셋을 붙이는 법」.

- **아이디 칸과 실시간 확인** — `LoginIdField`(라벨 · 안내 · 글자 + 아이콘 상태 줄 `aria-live`) · `useLoginIdAvailability`(입력이 멈춘 0.4초 뒤, 형식이 맞을 때만 `POST /account/login-id/availability`; 늦게 온 답은 버리고 같은 값은 다시 묻지 않는다; 429 · 네트워크는 「지금은 확인할 수 없어요」이지 거절이 아니다) · 규칙 함수 `loginIdProblem` · `normalizeLoginId` · `DEFAULT_LOGIN_ID_RULES` · `loginIdFieldError` · `loginIdProblemText` · `loginIdServerError` · `LOGIN_ID_CHECK_DELAY_MS`.
- **가입** — `SignUpScreen` 이 아이디 칸을 이메일 다음에 그린다(`SignUpScreen` 의 `loginId` prop — `createAuthRoutes` 가 발견으로 채운다). 서버의 400(`errors[].field=loginId`) · `409 ACCOUNT.LOGIN_ID_TAKEN` 은 칸 옆 오류. 인증번호 단계에서 아이디가 그 사이 나갔으면(409 — 시도는 닫히지 않는다) `LoginIdRetry` 가 그 자리에서 아이디만 다시 받는다(같은 `signUpId` · 같은 코드). `accountApi.verifySignUpCode(…, { loginId })`.
- **로그인** — 칸 라벨이 「아이디 또는 이메일」(`type="text"`)이 되고 `@` 가 있으면 `email`, 없으면 `username` 으로 보낸다(`signInCredentials` 한 군데, `identifierProblem`). 링크 로그인 모드에서 `@` 가 없으면 「이메일을 입력해 주세요」. 비밀번호 찾기 옆 「아이디 찾기」 링크.
- **아이디 찾기** — 새 경로 **`/forgot-id`**(`paths.forgotLoginId`, 발견을 쓰는 라우트에서만) · `ForgotLoginIdScreen`(비밀번호 찾기와 같은 틀 · 같은 캡차 자리, 늘 「있다면 보냈다」) · `accountApi.forgotLoginId`.
- **아이디 정하기 막** — `createLoginIdRequiredController` · `isLoginIdRequiredError` · `<LoginIdGate>` · `LoginIdRequiredScreen` · `loginIdSubmitOutcome`(아이디 없는 계정 `me.loginId === null` 또는 403 `ACCOUNT.LOGIN_ID_REQUIRED` → 아래를 `inert` 로 두고 덮는다; 내면 「정한 뒤에는 바꿀 수 없어요」 **확인 대화상자**; 409 는 칸 옆 오류; 다른 탭에서 이미 정했으면(`LOGIN_ID_ALREADY_SET`) 접는다; 주소 없는 계정에는 「이미 계정이 있나요?」 버리기 길; 로그아웃 · 계정 설정 길). `accountApi.checkLoginId` · `setLoginId`. 이메일 막과 같은 상태 기계(`gateController`)를 쓴다. 막의 순서는 서버와 같은 **아이디 → 이메일 → 약관**이고, 안쪽 막은 바깥 막이 `isReady()` 이고 `idle` 일 때만 서버에 묻는다(안 그러면 두 막이 함께 열려 안쪽 화면이 `inert` 아래에서 첫 포커스를 잃는다). 막은 라우터 밖이라 `onOpenSettings` 에 바깥 핸들을 꽂거나 기본 `<a href>` 전체 이동. `/account` 에서는 `standAside`. `chainForbiddenRecovery(loginIdRequired.recover, emailRequired.recover, reconsent.recover)`.
- **설정의 아이디 줄** — 세 모습: 정한 아이디(값 + 「바꿀 수 없어요」, 고치는 입력 없음) · 아직 안 정함(같은 칸 · 같은 확인으로 정한다; 이때 `/account` 는 아이디 정하기 · 이메일 · 계정 삭제만 연다 — `createAuthRoutes({ loginIdRequired })` 가 정한 뒤 막을 접는다) · 소셜로만 온 계정의 안내(「비밀번호를 만들면 아이디나 이메일로도 로그인할 수 있어요」 + 비밀번호 구역 또는 이메일 구역 단추). `AccountSettings` 의 `loginIdRules` · `onLoginIdChosen`.
- **관리자 표**(`@skeleton/auth/admin`) — 응답에 `loginId` 키가 있으면 「아이디」 열(안 정했으면 `-`)과 「아이디로 찾기」 칸. 찾기는 **정확히 일치만**이고 Enter 나 「찾기」 단추를 눌렀을 때만 질의한다(입력 중에는 서버에 가지 않는다). 결과가 비어도 칸은 남는다. `AdminAccountsTable` 의 `showLoginId` · `query` · `onQueryChange`, 타입 `AdminAccountsQueryState`.
- **이메일을 받는 시점(쓰기 때)** — `me.emailRequiredToWrite === true` 면 주소 없는 계정도 읽기는 되고 쓰기의 `403 ACCOUNT.EMAIL_REQUIRED` 가 등록 화면을 연다(쓰기용 제목 · 테두리 단추 「나중에 하기」 · `onLater` 와 `labels.emailRequiredDeclined` · 제공자 재확인으로 떠나기 전 「쓰던 내용은 사라져요」). 등록 뒤 붙잡은 호출은 같은 본문으로 한 번 다시 나간다(`Idempotency-Key` 를 넘긴 호출은 같은 키). `useEmailBeforeWrite(controller)` → `{ needed, ensure() }`(`ensure()` 는 boolean — 필요하면 등록 화면을 열고 `false`, 등록 뒤 사용자가 다시 누른다) · 댓글 칸 위의 막지 않는 띠 `<EmailWriteNotice controller />` · `emailWhenOf` · `stillNeedsAddress`. 쓰기 때 서버에서 주소 없는 계정의 설정은 서버가 403 으로 막는 구역(비밀번호 · 연락받을 이메일 · 로그인 수단)을 「이메일을 등록한 뒤에 할 수 있어요.」(`settingsNeedsEmail`) + 단추로 접는다.
- **막 사이의 순서와 모달** — `EmailRequiredGate` 의 `deferCheck`(바깥 막이 확인 중이거나 열려 있는 동안 로그인 직후의 `me` 를 미룬다 · 풀리면 한 번 묻는다 · 계정이 없으면 묻지 않는다 - `ReconsentGate` 와 같은 prop. 아이디 막의 「로그아웃」 뒤에 토큰 없는 `me` 가 나가 세션 종료 토스트가 뜨던 것을 없앴다) · 두 막이 `me` 에서 읽은 계정별 상태(아이디 · 제공자 · 버리기 길 · 대기 중 인증번호)는 계정 id 와 함께 두어 계정이 바뀌면 비운다 · 패키지 `AccountPage` 의 버리기는 로그아웃이 **끝난 뒤에** 로그인 화면으로 이동한다(`RequireAuth` 의 「돌아올 곳」 state 가 연결 의도를 덮지 않게) · 네이티브 모달 안에서 막힌 쓰기의 이메일 화면이 모달 밑에 깔리는 일을 막으려 **모달을 열기 전에 `ensure()`**: 게시판 `BoardComments` 의 `beforeDelete`, `AuthorProfileManager` 의 `beforeRemove` 가 새 선택 prop 이고 sample 의 닉네임 대화상자(띠 · 선택기 · 쓰기 전 확인) · 노트 · 글 삭제 확인 창이 쓴다(규칙은 `packages/auth/README.md`). 관리자 표의 「아이디로 찾기」 초안은 밖에서 질의가 바뀌면 따라간다.
- **새 문구 키**(`AuthLabels` — 영어 기본 · `koAuthLabels`): 아이디 칸 `loginId` · `loginIdHint(min,max)` · `problemLoginIdMissing` · `problemLoginIdSize` · `problemLoginIdChars` · `problemLoginIdSymbols` · `problemLoginIdDigitsOnly` · `loginIdChecking` · `loginIdAvailable` · `loginIdSavedAs(id)` · `errorLoginIdTaken` · `loginIdCheckUnknown` · `loginIdRetryHint`; 로그인 `signInIdentifier` · `problemIdentifierMissing`; 찾기 `forgotLoginIdLink` · `forgotLoginIdTitle` · `forgotLoginIdSubtitle` · `forgotLoginIdSubmit` · `forgotLoginIdSentBody(email)`; 막 `loginIdRequiredTitle` · `loginIdRequiredBody` · `loginIdRequiredSubmit` · `loginIdConfirmTitle(id)` · `loginIdConfirmBody` · `loginIdConfirm` · `loginIdConfirmBack`; 설정 `settingsLoginIdFixed` · `settingsLoginIdNoPassword(provider)` · `settingsLoginIdSetPassword` · `settingsLoginIdAddEmail` · `settingsEmailToWrite`; 쓰기 때 `emailRequiredWriteTitle` · `emailRequiredWriteBody` · `emailRequiredLater` · `emailRequiredWriteNotice` · `emailRequiredWriteNoticeAction` · `emailRequiredDeclined` · `emailRequiredReauthLosesDraft(provider)` · `emailRequiredDiscardConfirmLoginId(id)`; 관리자 `adminSearchLoginId` · `adminFindLoginId`; **스펙 밖에서 더한 것** `loginIdRequiredSettings`(막의 「계정 설정」 링크) · `adminSearchLoginId` · `adminFindLoginId` · `settingsNeedsEmail`(쓰기 때 서버에서 이메일이 먼저인 구역) · `loginIdRequiredDiscardBody(provider?)`(아이디 화면의 「이미 계정이 있나요?」 안내 - 아직 주소를 받기 전이라 주소를 전제하지 않는다. 이메일 화면의 `emailRequiredDiscardBody` 「이 주소로 …」는 값 그대로).
- **오류 코드 · 타입** — `ErrorCodes.ACCOUNT_LOGIN_ID_REQUIRED` · `ACCOUNT_LOGIN_ID_TAKEN` · `ACCOUNT_LOGIN_ID_ALREADY_SET`; `LoginIdAvailability` · `LoginIdRules` · `SignInCredentials` · `SignUpLoginId`; `AccountMe.loginId?` · `emailRequiredToWrite?`; `AuthMethodsWire.loginId?`.
- **스토리 · 가짜** — `Patterns/Auth/Login id field` · `Login id required` 와 `Sign up` · `Sign in` · `Mail link landings`(아이디 찾기) · `Email required`(쓰기 때 모습) · `Account settings`(아이디 줄 세 모습 · 쓰기 때 접힘) · `Admin accounts`(열 · 찾기)의 새 스토리. 가짜 `createFakeAccountApi({ loginId: { value, taken, takenOnConfirm, minLength, maxLength }, emailRequiredToWrite })`.
- **sample** — 앱 맨 위 `LoginIdGate`(+`api/loginIdRequired.ts` · `auth/gateShared.ts`) → `EmailGate` → `LegalGate` 순서, 글쓰기 단추 · 댓글 칸이 `useEmailBeforeWrite` · `EmailWriteNotice`, e2e `loginId.e2e.ts`(양식 가입 → 아이디로 로그인 → 이메일을 바꿔도 같은 아이디 → 아이디 찾기 메일 → 소셜 첫 로그인의 막 · 확인 · 새로고침 · 버리기 → 값 스캔) 와 `emailRequired.e2e.ts` 를 쓰기 때 여정으로 다시 썼고, 증거 스크립트 `walkthrough.loginId.shots.ts` · `walkthrough.email.shots.ts`.

**한 묶음으로 내보낸다**: 쓰기 때 서버(`required-when: WRITE`)에 이 프론트 이전 판을 붙이면 `emailRequired` 가 늘 `false` 라 이메일 막이 뜨자마자 접힌다(스펙 §9.4). 백엔드와 프론트는 같이 올린다.

### Changed — 아이디 · 쓰기 때 이메일 묶음에서 업그레이드하는 앱이 알아야 할 것(`@skeleton/auth` · `apps/sample`)

키가 없는 서버(아이디를 안 쓰고 이메일은 로그인 직후/안 받음)에서 바뀌는 마크업은 아래 h2 하나뿐이다.

- **`SignInScreen` 의 `onPasswordSignIn` 인자 타입**이 합집합 `SignInCredentials`(`{ email, password }` | `{ username, password }`)가 됐다 — 예전 모양은 그대로 들어오지만 **인자를 `{ email: string; password: string }` 으로 직접 적은 앱은 타입 오류**다(`SignInCredentials` 로 받거나 `auth.login(credentials)` 에 그대로 넘긴다). `username` 은 아이디를 켠 화면에서 `@` 없는 입력에만 간다.
- **`AuthPaths` 에 필수 키 `forgotLoginId`**(`/forgot-id`) — `createAuthRoutes({ paths: { … } })` 에 일부만 주는 앱은 그대로(기본값이 채운다). **완전한 `AuthPaths` 객체를 직접 만드는 앱**만 키를 더한다.
- `AuthLabels` 에 키가 늘었다(위 목록) — `AuthLabels` 전체를 직접 번역하는 앱은 컴파일 오류가 나므로 키를 더한다(`mergeLabels` 로 일부만 주는 앱은 영어 기본으로 채워진다). `AccountApi` 인터페이스에 `checkLoginId` · `setLoginId` · `forgotLoginId` 가 늘어, 가짜 `AccountApi` 를 손으로 구현한 테스트는 세 메서드를 더한다.
- **관리자 표의 빈 상태 제목이 h3 → h2**(쪽 제목 `h1` 바로 아래라 수준을 맞췄다) — 키가 없는 서버에서 바뀌는 **유일한 마크업**.
- **「쓰기 때」 서버에서 이메일 막은 로그인 직후가 아니라 쓰기의 403 / 쓰기 전 확인(`useEmailBeforeWrite`)에서 열린다.** 열려 있는 동안의 「다른 탭에서 등록」 판정이 `emailRequired` 가 아니라 **주소 유무**로 바뀌었다(`stillNeedsAddress` — 요구하는 키가 하나도 없는 응답은 예전처럼 접는다). 로그인 직후 서버의 동작은 그대로다.
- **`apps/sample`**: 이메일 화면이 **로그인 직후에서 쓰기 때로** 바뀌었다(백엔드 샘플이 `required-when: WRITE` 로 돈다 — 소셜 계정이 읽는 화면을 전부 돌아도 막이 안 뜨고 글쓰기 · 댓글에서 뜬다), 앱 맨 위에 **아이디 게이트**가 늘었고, e2e 가 올리는 백엔드는 아이디 정하기 · 실시간 확인의 IP 한도만 올려 띄운다(한 IP 에서 계정을 수십 개 만든다 — `globalSetup.ts`).
- **지원하지 않는 조합**: `methods` 를 환경변수 등으로 덮어써 발견을 끈 앱(`VITE_AUTH_METHODS`)은 아이디 화면(가입 칸 · 로그인 라벨 · `/forgot-id`)이 켜지지 않는다. 그런 앱을 아이디를 켠 서버에 붙이면 가입 본문에 `loginId` 가 없어 400 이다 — 아이디를 켠 서버에 붙이는 앱은 발견을 쓴다.

**알려진 한계 (이 묶음 전부터)**

- **캡차를 켠 앱**: 제출이 실패한 뒤 캡차 토큰을 새로 받지 않는다 — `SignUpScreen` 은 `renderCaptcha({ onToken })` 으로 토큰을 받아 쥐기만 하고 실패 뒤에 비우지도 위젯을 `reset()` 하지도 않으며, 슬롯에 실패를 알리는 길도 없다. 토큰은 한 번만 쓰이므로(`useTurnstileToken` 의 설명) 같은 화면에서 다시 내면 이미 쓴 토큰이 간다. 실패한 가입을 다시 시도하려면 위젯을 다시 그리게(화면을 다시 열게) 해야 한다. 이 묶음이 만든 문제는 아니다. `ForgotLoginIdScreen` · `ForgotPasswordScreen` 도 같은 슬롯 모양이다.
- 계정이 바뀐 **직후** 늦게 도착한 이전 계정의 403 은 새 계정의 막을 열 수 있다(`setAccount` 는 바뀐 때 열려 있던 화면 · 붙잡은 호출만 접는다 — 이미 있던 이메일 막과 같은 동작). 열린 막은 서버에 다시 묻는 순간 접힌다.
- 제공자 재확인으로 페이지를 떠나면 쓰던 글은 사라진다(초안 저장은 이번 범위 밖) — 화면이 떠나기 전에 말한다.

### Changed — 소셜 연결이 `ACCOUNT.IDENTITY_TAKEN` 으로 막히면 출구를 말한다 (`@skeleton/auth`)

- 문구 `errorIdentityTaken` 이 막연한 「이미 다른 사람과 연결돼 있어요」 에서 「그 계정으로 로그인한 뒤 설정에서 연결을 끊거나 그 계정을 삭제하고 다시 시도해 주세요」 로 바뀌고, 제공자 이름을 아는 화면(연결 본인 확인 · 연결 콜백)은 새 라벨 `errorIdentityTakenFor(provider)` 로 「이 ○○ 계정은 …」 을 보여 준다. 소셜을 끊은 뒤 그 소셜로 다시 로그인하면 _내가 만든 다른 계정_ 이 쥐고 있을 수 있다 (백엔드 `docs/accounts.md` "소셜을 끊은 뒤 다시 연결하려다 막힌 길"). 스토리 `SocialLinkTakenByAnotherAccount`.

### Fixed — 운영자 API 를 실제 백엔드 계약에 맞춤 (F5)

백엔드의 결제 HTTP(B7, 커밋 `32ba6d4`)가 생겼다. 그동안 가정으로 만든 운영자 API 를 백엔드 `docs/payment-http-contract.md` 와 컨트롤러 · DTO 에 한 줄씩 대조해 맞췄다(문서와 코드가 다르면 코드가 사실).

- **이력**: `events[].id` 는 그 주문 이력 안의 순번(1 부터)이다 - 타입을 `number` 로 좁히고 전역 키로 쓰지 않는다고 적었다(화면의 목록 키는 한 주문 안에서만 쓴다). `actorId`(`string | null`)를 타입에 더했다(화면에 그리지 않는다).
- **탈퇴한 계정**: `AdminOrderListParams.includeErased`, 목록 조건 `AdminOrderFilter.includeErased`, 전체 탭의 스위치 「탈퇴한 계정의 결제도 보기」(`AdminOrderTable` 의 `showErasedToggle` - 확인 필요 탭에는 없다: 서버가 거기서는 늘 보여 준다). 계정 id 가 탈퇴 대체 값(`deleted:…`, 백엔드 `erasure.account-id=TOMBSTONE`)이면 목록 줄과 한 건 화면에 「탈퇴한 계정」이 붙는다 - 운영자 응답의 `accountErasedAt` 이 늘 와서 `KEEP` 에서도 가른다(타입의 `?` 는 방어 - 칸이 없으면 이 대체 값으로만 가른다).
- **웹훅 수신함**: 표식 줄(`resourceType=LIMIT_MARKER`)은 코드 대신 한 문장으로 그린다. 「다시 처리」는 1회차 리뷰에서 손이 필요한 줄로 좁혔다(아래).
- **맞춘 뒤에도 남는 사유**: 파생 사유(`STALE_CONFIRMING` · `STALE_REFUND` · 오래된 `FULFILMENT_UNRESOLVED` · `REFUND_APPLY_UNRESOLVED`)는 한 건 상세와 맞추기 응답에도 오고 맞춰도 안 풀릴 수 있다. 맞춘 뒤에도 사유가 남으면 「누르면 다시 물어봐요」를 되풀이하지 않고 「결제사에 다시 물었지만 아직 남아 있어요 …」 / 「그 일을 다시 걸었어요. 끝나면 이 표시가 사라져요」라고 말한다.
- **주문 만들기 응답**: `checkout` 은 같은 키 재전송에서 주문이 이미 `PENDING` 이 아니면 `null`, `clientKey` 도 `null` 일 수 있다. 견본 앱의 `startCheer` 는 결제창을 열지 않고 주문 실패로 돌려주며(다음 누름은 새 주문), `openCheckout` 은 키 없이는 SDK 를 부르지 않고 던진다.
- **`closedBy`**: 운영자 환불 줄에도 온다 - 그것을 따른다(`ORDER_REFUNDED` 추정은 1회차 리뷰에서 지웠다).
- **그대로인 것(확인했다)**: 환불 줄의 `origin: PROVIDER` · `reasonCode: PROVIDER_CONSOLE` 타입과 라벨(사용자 · 운영자 화면 모두)은 이미 있었다. 돈과 닿는 동작(멱등 키 수명 · 확정/모름 분류 · 창의 값 = 보낸 값 · 낡은 화면 차단)은 바꾸지 않았다.
- **e2e**: 백엔드 설정에 주문 만들기 요청 수 한도를 푼다(`skeleton.payment.http.order-rate-limit.account-capacity` · `ip-capacity`, 기본 10 · 30 / 10분) · 웹훅 주소 조각(`skeleton.payment.webhook.path-token`, e2e 전용 값). 실행하지 않았다(견본 앱 백엔드가 아직 없다) - 타입체크와 설정 단위 시험만.
- **문서**: `packages/payment/README.md` 의 「운영자 API 가정」을 「운영자 API — 백엔드 계약과 맞춘 표」로 고쳐 썼다. 시험 픽스처의 429 코드는 `COMMON.TOO_MANY_REQUESTS`.
- **새 필수 문구 키**(`labels` 를 통째로 만들어 주는 앱은 채워야 한다): `admin.reviewHintSynced` · `reviewHintRetrySynced` · `erasedAccount`, `admin.orders.includeErased` · `includeErasedHint`, `admin.webhooks.limitMarker`.

### Fixed — F5 리뷰 1회차

- **주문 만들기 `429`**: 「다시 눌러 주세요」는 사실이 아니었다(고정 창이 끝날 때까지 몇 번을 눌러도 429이고 같은 키 재전송도 한도를 쓴다). 견본 앱은 `retryAfterSeconds` 로 언제 다시 누를지를 말하고(처음에는 「N분 뒤에」 - 2회차에서 풀리는 시각으로 바뀌었다) 그 시간 동안 단추를 `aria-disabled` + 이유로 막는다. 시간을 못 읽으면 「잠시 뒤에」, 단추는 그대로. (`orderFailureOf`)
- **`checkout: null`**: 주문 상태로 가른다 - `PAID` · `CONFIRMING` · 환불 계열이면 실패가 아니라 그 결제의 화면으로. `clientKey: null` 이면 만든 주문을 돌려놓고(`abandon`) 「지금은 결제를 쓸 수 없어요」.
- **맞춘 뒤의 안내**: `AdminOrderPanel` 의 `synced` 는 이제 깃발이 아니라 맞추기가 돌려준 주문(`useSyncOrder` 의 `data`)이다. 그 응답의 `reviewReason` 이 지금 화면의 사유와 같을 때만 「맞췄어요」 · 「맞춰 봤지만 …」를 말한다 - 맞춘 뒤에 새로 생긴 사유(맞추기 → 직접 환불 → `REFUND_MISMATCH`)에는 처음의 말이고 맞추기가 채운 단추로 남는다. `useDirectRefund` · `useRefundDecision` 에 `onSend`(보내는 순간 - 2회차에서 `onDone` 의 이름과 때를 바꿨다)가 생겼고 견본 화면은 `sync.reset` 을 꽂는다.
- **웹훅 수신함 「다시 처리」**: `FAILED` · `DEAD` 줄과 받은 지 오래된(`staleReceivedAfterMs`, 기본 10분) `RECEIVED` 줄에만. `IGNORED` · `PROCESSED` · 갓 받은 줄은 단추가 없다(서버는 누를 때마다 결제사 조회 하나를 넣는데 화면은 안 바뀌어 연타를 불렀다). `retried`(id → 누른 시각)에 든 줄은 「다시 넣었어요」 상태 글자. 표식 줄은 기다리는 중 / 확인이 끝남 두 문장(`webhooks.limitMarker` 가 글자에서 `{ waiting, done, name }` 로 바뀌었다), 수신함 `id` 는 `number`. 「결제사 결제 번호」 칸은 우리 주문의 결제 키이고 `order:<id>` 는 「결제사 결제 번호 없음 (결제 …)」(`webhooks.noProviderPayment`).
- **환불 `400 COMMON.VALIDATION_FAILED` · `PARAMETER_VALIDATION_FAILED` · `MALFORMED_REQUEST`**: 선점 전의 확정 거절이다 - 키를 놓고 칸을 열며 「보낸 내용이 올바르지 않아요 …」(`refundDialog.errors.invalid`, `RefundProblem` 의 `invalid`). 그 밖의 `COMMON.*` · 코드 없는 4xx 는 여전히 모름이다.
- **`PAYMENT.PROVIDER_PAYMENT_NOT_FOUND`**(404, 백엔드가 이 이름으로 맞춘다): 맞추기가 「결제사가 이 결제를 찾지 못했어요. 결제사 화면에서 확인해 주세요」(`panel.syncErrors.providerNotFound`).
- **`accountErasedAt?: string | null`**: 운영자 주문 응답의 선택 칸. 「탈퇴한 계정」 표시가 이 칸을 먼저 본다(`isErasedAccount`).
- **옛 서버를 위한 대체 읽기 삭제**: 결제 HTTP 는 이번에 처음 생겨 그런 서버가 없다 - `Order.openRefundStatus` · `Refund.closedBy` 는 필수 칸이고 `OrderStatusBadge` 의 `refundPending` prop 과 `ORDER_REFUNDED` 로 시스템을 추정하던 읽기는 없어졌다(`closedBy` 만 읽고 없으면 본인).
- **운영자 호출의 반환 타입**: `refundOrder` · `approveRefund` · `rejectRefund` 는 `AdminRefund`.
- **문구**: 「탈퇴한 계정의 결제도 보기」 설명에 「확인 필요 탭과 결제 번호 찾기에서는 늘 보여요」. README 에 「백엔드가 맞출 것」 표.

### Fixed — F5 리뷰 2회차

- **주문 만들기 `429` 의 「N분」이 줄지 않던 것(Important)**: 문장이 남은 분 대신 **풀리는 시각**을 말한다(「요청이 많아요. 2026. 10. 9. 오후 3:42 이후에 다시 눌러 주세요」 · 단추 옆 「… 이후에 다시 누를 수 있어요」 - 문구 `cheer.rateLimited` · `cheer.rateLimitedWait` 의 변수가 `minutes` 에서 `time` 으로 바뀌었다). 타이머가 풀릴 때 막힘과 **위험 띠를 함께** 비운다. 판정은 순수 함수로 뺐다(`cheerHold.ts` 의 `holdReasonOf` · `openingIn` · `noticeAfterOpening`). `orderFailureOf` 의 `rateLimited` 에서 `minutes` 칸을 지우고 `until` 만 둔다.
- **`unavailable`(서버에 결제창 키가 없음) 뒤에도 눌리던 단추**: 이 결과를 받으면 `config.available === false` 와 같은 막힘 + 이유(`aria-disabled` + 설명)로 둔다 - 화면을 새로 열 때까지. 누를 때마다 주문 + 돌려놓기가 나가 열 번이면 429 이던 것.
- **주문 만들기 `429` 가 전역 토스트로도 뜨던 것**: `useCreateOrder(api, { meta })` 가 뮤테이션에 `meta` 를 붙일 수 있고, 견본 화면은 `quietStatuses: [429]` 를 싣는다 - 이 호출만 조용하다(`COMMON.TOO_MANY_REQUESTS` 를 앱 전체에서 거르지 않는다 - 다른 화면은 토스트가 유일한 안내다).
- **웹훅 수신함 `retriedIds` → `retried`(id → 누른 시각, ms)**: 다시 넣은 줄은 `RECEIVED` 가 되지만 `receivedAt` 은 그대로라서, 목록이 다시 읽힐 때 비우면 작업이 도는 중에 단추가 곧바로 다시 나왔다. 부품이 누른 뒤 `staleReceivedAfterMs` 동안 그 줄의 단추를 감추고, 비우는 일은 부모에게서 없어졌다(깨지는 변경 - 이 기능은 아직 나가지 않았다).
- **표식 줄이 `FAILED` · `DEAD` 일 때**: 「잠시 뒤 한 번에 확인해요」는 사실이 아니다 - 「…확인하지 못했어요. 다시 처리해 주세요」(새 필수 문구 키 `admin.webhooks.limitMarker.failed`). 「아무도 확인하지 않는다」는 `DEAD` 에만 맞았다 - 3회차에서 `FAILED` 는 따로 갈랐다(아래). README 에 `now` 는 서버 시계를 넘기는 것이 좋고 넘기면 1분 자동 갱신이 꺼진다는 것, `staleReceivedAfterMs` 는 백엔드 `skeleton.payment.webhook.per-order-limit.window`(기본 10분) 이상이어야 한다는 것을 적었다.
- **맞춤 → 풀림 → 같은 종류로 다시 찍힐 때의 거짓 「맞춰 봤지만 아직 어긋나 있어요」**: 견본 화면이 사유가 `sync.data.reviewReason` 과 달라지는 순간 `sync.reset()` 을 부른다(`syncNoteIsStale`) - 한 번 갈라지면 되살아나지 않는다.
- **`useDirectRefund` · `useRefundDecision` 의 `onDone` → `onSend`**: 성공에서만 불려, 결과를 모르는 환불 뒤에도 「결제사와 맞췄어요」가 남았다. 이제 **보내는 순간** 불린다(직접 환불 · 승인 · 거절 모두). 견본 화면은 맞추는 중이면 끊지 않는다.
- **문서**: 환불 줄의 `closedBy` 는 필수 칸(README) · `refundOrderMutation` 주석에 `invalid` 셋 · `adminAccessProblem` 이 `PAYMENT.PROVIDER_PAYMENT_NOT_FOUND` 404 를 「꺼짐」으로 읽지 않는다.

### Fixed — F5 리뷰 3회차

- **표식 줄 `FAILED`**: 「아무도 다시 확인하지 않는다」는 사실이 아니다(계약 §3 수신함 - `FAILED` 는 이번 시도 실패, 작업이 다시 한다. 시도를 다 쓴 것은 `DEAD`). `FAILED` 는 「…확인하지 못해 다시 시도하고 있어요」(새 필수 문구 키 `admin.webhooks.limitMarker.retrying`), 「…확인하지 못했어요. 다시 처리해 주세요」(`failed`)는 `DEAD` 에만.
- **다시 넣은 줄이 감추는 시간 안에 `DEAD` 가 되면**: 단추가 최대 10분 가려지던 것 - `DEAD` 는 「다시 넣었어요」를 지우고 단추를 보인다.
- **주문 만들기 `503 PAYMENT.UNAVAILABLE`**: 클라이언트 키가 없을 때와 같은 막힘이다 - `orderFailureOf` 가 `unavailable` 을 돌려주고 견본 화면이 「지금은 결제를 쓸 수 없어요」 + `aria-disabled` 단추로 둔다(다시 눌러도 같고 누를 때마다 한도를 썼다).
- **문서**: README 의 웹훅 수신함 줄(`retried` · 표식 줄 네 문장)과 「N분 뒤에」 잔재, 훅 서명의 `onSend?`, 「백엔드가 맞출 것」을 「백엔드와 맞춘 곳」으로(네 가지 모두 백엔드 `62d45a5` 에서 맞춰졌고 `accountErasedAt` 의 근거는 계약 §1.4), 운영자 `sync` 의 `404 PAYMENT.PROVIDER_PAYMENT_NOT_FOUND`, `quietStatuses` 는 견본 앱의 `createQueryClient` 만 읽는다는 것. 타입 주석(`accountErasedAt` · `available` · `checkout: null`)도 사실대로.

### Fixed — 프런트 전체 독립 리뷰 3회차 (R-FE)

- **이미 환불된 환불 요청이 「요청하지 못했어요」로 읽히던 것(2회차가 만든 회귀)**: `requestRefundMutation` 은 답 줄이 `REJECTED` · `WITHDRAWN` · `FAILED`(운영자 쪽 `RefundNotDoneError` 와 같은 집합)일 때만 `RefundRequestNotOpenError` 를 던진다. `SUCCEEDED` · `PENDING` · `REQUESTED` 는 성공이라 창이 닫히고 다시 읽은 화면이 사실을 말한다. `RefundRequestDialog` 는 이 오류를 「이 환불 요청은 이미 닫혔어요. 다시 요청하려면 한 번 더 눌러 주세요」(`refundDialog.errors.closed`)로 말하고, 샘플 앱의 전역 토스트는 `RefundRequestNotOpenError` 를 거른다(영어 내부 문장이 뜨지 않는다).
- **「결제사와 맞추기」 뒤의 「가는 중일 수 있어요」**: 모름이 풀리면(`direct.unsure` 가 거짓이면) 말하지 않는다. 문장에서 초를 뺐다(누른 순간의 값이라 줄지 않는다): `admin.panel.syncHeld` 는 이제 함수가 아니라 글자다. `heldSecondsOf` · `syncHeld` prop 은 그대로(값이 있으면 말한다).
- **유예에 바닥**: `max(보낸 때 + unsureHoldMs, 모름이 된 때 + 15초)` - 보낸 때가 실제로 나간 때가 아닐 수 있다(오프라인으로 멈췄다 나간 변경 · `mutations.retry`). `UnsureState` 에 `unsureAt` 이 더해졌고 `useDirectRefund` 에 `unsureFloorMs?`(기본 15초 - 스토리용 손잡이)가 생겼다.
- **직접 환불 · 승인의 409 `PAYMENT.MODE_MISMATCH`**: 「환불하지 못했어요. 다시 해 보세요」가 아니라 맞추기 쪽과 같은 모드 문장(`admin.refundDialog.errors.modeMismatch`).
- **문서**: README 의 `POST /orders/{id}/sync` 칸에 `409 PAYMENT.MODE_MISMATCH`, 「서버가 409 로 막는 것은 `REFUND_MISMATCH` 뿐」을 모드 불일치까지로 고쳤고(주석 포함), 유예가 넘어야 하는 구간(서버의 선점 전 구간)을 적었다.
- **새 필수 문구 키**: `refundDialog.errors.closed`, `admin.refundDialog.errors.modeMismatch`.

### Fixed — 프런트 전체 독립 리뷰 2회차 (R-FE)

- **45초 유예 안에 누른 「결제사와 맞추기」가 말없이 아무 일도 안 하던 것**: 유예를 모름이 된 때가 아니라 **보낸 때**(`refund.submittedAt`)부터 센다 - 가장 흔한 모름인 시간 초과는 모름이 됐을 때 이미 유예가 지나 있어 첫 맞추기가 바로 놓는다. 다시 보내면 보낸 때가 바뀌어 다시 센다(`unsureSince` 추적은 없앴다). 유예 때문에 못 놓았으면 `forget()` 이 `{ kind: 'hold', waitMs }` 를 돌려주고(놓았으면 `release`, 놓을 것이 없으면 `none` - 반환형이 `void` 에서 바뀌었다), `heldSecondsOf(verdict)` 를 `AdminOrderPanel` 의 새 prop `syncHeld` 에 주면 「보낸 환불이 아직 가는 중일 수 있어요. 약 N초 뒤에 다시 맞춰 주세요」를 `role="status"` 로 말한다. `mayForgetUnsure` 는 `unsureVerdict` 가 대신한다.
- **`LATE_RESULT` 가 「환불 안 됨 + 이유 코드」로 읽히지 않는다**: `refundFailure` 에 `LATE_RESULT`(「닫힌 뒤에 결제사의 환불 결과가 도착했어요. 다른 환불 줄과 환불된 금액을 확인해 주세요」) · `REFUND_DECLINED` 를 더했다. `PROVIDER_PENDING_EXPIRED` 는 줄에 안 찍히고 이력에만 남으니 줄 코드 표에서 빼고, 새 표 `eventCodes` 로 이력에서 문장으로 그린다(`LATE_RESULT` 는 이력 종류가 `REFUND_UNKNOWN` 이라 「환불 결과를 아직 몰라요」로 읽히던 이름을 문장이 대신한다). `RESULT_MISMATCH` 는 「결제사의 답이 요청과 맞지 않았어요」(금액만 어긋나는 것이 아니다), `PROVIDER_PENDING` 은 「결제사에서 아직 환불 중이에요」(금지어 「처리 중」의 변형 「처리하는 중」 - 낱말 시험이 이제 이것도 잡는다. 웹훅 「다시 처리」의 진행 글자도 「다시 시도하는 중」으로). 운영자 응답에 `closedBy` 가 없고 `failureCode: ORDER_REFUNDED` 뿐이어도 시스템이 닫은 줄로 읽는다.
- **`onSync` 없는 조립에서 단추 차단이 막다른 길이 아니다**: 서버가 환불을 막는 것은 `REFUND_MISMATCH` 뿐이다 - 맞추기 단추가 없으면 그것만 막고 「결제사와 어긋나 있어 환불할 수 없어요」(「먼저 결제사와 맞춰 주세요」는 맞추기 단추가 있을 때만). 맞춘 뒤에도 사유가 남으면 「맞춰 봤지만 아직 어긋나 있어요. 결제사 화면에서 확인해 주세요」. 모드가 달라 맞추기가 `409 PAYMENT.MODE_MISMATCH` 로 실패하면 「다시 해 보세요」가 아니라 「…지금 키로는 맞출 수 없어요」.
- **사용자 쪽**: 「환불 요청함」 상태 줄은 방금 낸 요청 줄(`requestRefund.data.id`)이 목록에 있으면 말하지 않는다(요청 → 운영자가 정함 → 재조회 성공 → 나중의 재조회 실패에서 되살아나던 것; 거둠 비교는 이것으로 대신한다). 환불 요청의 답 줄이 `REQUESTED` 가 아니면(든 키로 정해진 줄을 돌려받음) 창을 닫지 않고 `RefundRequestNotOpenError` 로 실패하며 키를 놓는다. 승인의 답 줄이 `FAILED` 인 2xx(늦은 결과)는 「요청은 환불 안 됨으로 닫혔어요 …」가 아니라 「이 환불 줄은 환불 없이 닫혔어요. 환불 내역을 확인해 주세요」(402 확정 거절은 그대로).
- **문서**: `[Unreleased]` 에 R-FE 1회차 항목을 더하고, 틀려진 두 문장(환불 요청의 무효화, 맞추기가 든 키를 놓는 조건)을 고쳤다. 스토리의 `PAID` + `AMOUNT_MISMATCH` 는 백엔드가 만들지 않는 상태라 `REFUND_MISMATCH` 로 고쳤다. `retryWebhookEventMutation` 도 「재조회가 끝날 때까지 pending」 표에 넣었다.
- **새 필수 문구 키**(`labels` 를 통째로 만들어 주는 앱은 채워야 한다): `admin.eventCodes`, `admin.panel.moneyOff` · `stillOff` · `syncHeld(seconds)` · `syncErrors.modeMismatch`. `admin.refundFailure` 의 키 집합이 바뀌었다(`LATE_RESULT` · `REFUND_DECLINED` 추가, `PROVIDER_PENDING_EXPIRED` 제거).

### Fixed — 프런트 전체 독립 리뷰 1회차 (R-FE)

- **`orderLink` 가 `ReactNode` 에서 함수가 됐다(깨지는 변경)**: `AdminRefundDialog` 의 `orderLink?: (buttonLikeClassName: string) => ReactNode`, `useRefundDecision` 의 `orderLink?: (refund, buttonLikeClassName) => ReactNode` - 날 `<a>` 는 글자로만 그려지니 창이 버튼 모양 클래스를 건넨다(라우터의 `<Link className={className} …>`).
- **새 필수 문구 키**: `admin.reviewHintRetry`(지급 · 회수가 끝내 안 된 사유의 안내) · `admin.refundFailure`(우리 쪽 환불 줄 코드 → 문장) · `admin.panel.syncFirst` · `refundClosedBySystem`(`WITHDRAWN` 을 시스템이 닫은 줄의 알약). `ReviewReason` 에 `FULFILMENT_UNRESOLVED` · `REFUND_APPLY_UNRESOLVED` · `STALE_CONFIRMING` · `STALE_REFUND`, 이력에 `REFUND_APPLIED` 가 더해졌다.
- **돈이 어긋난 사유는 돈이 나가는 단추를 막는다**: `REFUND_MISMATCH` · `AMOUNT_MISMATCH` · `ORDER_MISMATCH` · `MODE_MISMATCH` 이면 「환불하기」 · 「요청대로 환불하기」가 `aria-disabled` + 「먼저 결제사와 맞춰 주세요」로 막히고 채운 단추는 「결제사와 맞추기」다(2회차에서 `onSync` 없는 조립은 `REFUND_MISMATCH` 만으로 좁혔다).
- **`Refund.closedBy`**: `WITHDRAWN` 줄을 `USER`(본인이 거뒀다) · `SYSTEM`(환불이 끝나 요청이 닫혔다)이 닫았는지 - 없으면 `USER`.
- **`unsureHoldMs`**: `useDirectRefund` 의 새 옵션(기본 `OPERATOR_REFUND_TIMEOUT_MS` = 45초) - 「결제사와 맞추기」가 모름(잠금 + 든 키)을 놓기까지의 유예.
- 변경은 **재조회가 끝날 때까지 pending** 이다(`onSettled` 가 무효화 약속을 돌려준다 - `void` 로 버리면 낡은 화면에서 같은 환불이 한 번 더 나갈 수 있다; 변경마다 시험이 지킨다). 환불 요청은 확정 거절이나 답 유실에도 무효화한다.
- 환불 답 줄이 `FAILED` 인 2xx 는 「환불 안 됨, 다시 누르면 새로 나가요」가 아니라 「환불 없이 닫혔어요. 환불 내역을 확인해 주세요」(늦은 결과가 돈을 움직였을 수 있다). 직접 환불의 `409 REFUND_IN_PROGRESS` 가 열린 요청(`REQUESTED`)이면 「기다리는 환불 요청이 있어요」, 사용자 쪽은 「이미 환불을 요청했어요」.
- e2e(작성만, 실행하지 않았다): 환불 요청 거둠 시나리오 ⑧, 운영자 「모든 상태」 탭이 빈 상태도 받아들임.

### Fixed — 창에 보이는 값 = 보낸 값, 상태 줄 = 서버가 읽어 준 지금 (F4 리뷰 3회차)

- **닫아 둔 창이 확정 오류로 다시 열려도 금액 · 사유가 보낸 값 그대로다**: 부분 환불을 보내고 × 로 닫았는데 서버가 확정 답(402 일시 거절 · 503 · 환불 안 됨 줄 · 404)을 주면 창이 다시 열리는데, 그때 처음 모습(전액 · 운영자 사유)으로 돌아가 있어 오류 옆의 열린 확인 한 번에 보낸 적 없는 전액이 나갈 수 있었다. 창은 **오류가 남아 있지 않을 때만** 열 때 처음 모습으로 돌아온다(`ask()` 가 이미 오류를 지운다).
- **보내는 중에는 금액 · 사유 칸을 고칠 수 없다**: 읽기 전용이되 닿고, 이유 한 줄(「보내는 중이라 금액과 사유를 바꿀 수 없어요」 · 새 문구 `refundDialog.sending`, ko · en)이 두 칸의 설명이다. 보내는 동안 고친 값이 모름으로 끝나며 「잠긴 값」이 되어 확인 한 번에 새 키로 나가던 길이 막힌다. **잠긴 칸(보내는 중 · 결과를 모름)은 적던 글자가 아니라 보낸 변수를 보인다** - `AdminRefundDialog` 의 새 prop `sent`(`useDirectRefund` 가 변경의 `variables` 를 준다).
- **「방금 한 일」 상태 줄은 다시 읽기가 실패한(`stale`) 동안에만 보인다**: 변경의 답은 재조회가 성공해도, 결제사와 맞춰도 남아 「환불 중이에요」 · 「환불 요청함」이 사실보다 오래 남았다. 이제 재조회가 성공하면 환불 줄이 사실을 말한다. 낡은 화면에서도 줄 id 로 목록에서 찾아 그 줄이 답보다 더 간 상태면 그 줄이 말한다(답 `PENDING` 이 목록에서 `FAILED` 면 말하지 않는다). 직접 환불과 승인이 둘 다 있으면 더 최근 것(`useDirectRefund().doneAt` · `useRefundDecision().approvedAt`). 사용자의 「환불 요청함」도 `refreshFailed` 일 때만. `AdminOrderPanel.refunded` 는 이제 `id` 를 포함한다(`Pick<Refund, 'id' | 'status' | 'amount'>` - 환불 줄 그대로 주면 된다).
- **「결제사와 맞추기」 성공이 든 키도 놓는다**(`IntentKeys.clear()`; 단 **보낸 지 `unsureHoldMs` 가 지난 뒤에만** - R-FE 1 · 2회차 항목): 장부가 결제사와 맞았으니(나가 있던 환불은 환불 줄로 보인다) 그 뒤의 환불은 운영자가 새로 정한 새 의도다. `forget()` 은 **누른 때가 아니라 끝난 순간**의 상태를 본다 - 그 사이 같은 키로 다시 보내는 중이면 건드리지 않는다(보내는 중인 변경을 `reset()` 하지 않는다). `useOperatorRefund(api, keys?)` 는 키 보관소를 부모가 줄 수 있다.
- **낡은 화면에서 채운 단추는 막힌 「요청대로 환불하기」가 아니다**: `stale` 이면 승인이 채움 후보에서 빠져 「결제사와 맞추기」가 채워진다(화면당 채운 단추 하나).

### Fixed — 나간 환불은 말로 하고, 모르는 환불은 키를 놓지 않는다 (F4 리뷰 2회차)

- **환불이 나갔는데 재조회만 실패해도 같은 환불이 한 번 더 나가지 않는다**: `AdminOrderPanel` 의 `refunded`(방금 나간 줄)가 「환불했어요: 금액」 · 「환불 중이에요: 금액」을 상태 글자(`role="status"`)로 말하고, `stale`(다시 읽기 실패)이면 돈이 나가는 두 단추(「환불하기」 · 「요청대로 환불하기」)가 `aria-disabled` + 이유(「최신 내용을 불러온 뒤에 환불할 수 있어요」)로 막힌다. 이미 열린 창의 같은 키 재시도는 그대로다. 운영자 한 건 화면의 띠는 「아래 숫자가 낡았을 수 있어요」라고 말한다. 사용자 쪽 한 건(`OrderSummary` 의 `stale`)도 낡은 화면에서 「환불 요청」을 또 내지 못하게 막고, 낸 요청을 「환불 요청함」으로 말한다.
- **「결과를 모름」 상태에서 든 키가 조용히 풀리지 않는다**: 결과를 모르는 동안 직접 환불 창의 금액 · 사유 칸은 잠긴다(읽기 전용이되 닿고, 이유 한 줄이 두 칸의 설명) — 키는 의도(주문 · 사유 · 금액)별이라 값이 바뀌면 새 키가 나가 이미 나간 부분 환불이 한 번 더 나갈 수 있었다. 일하는 중에 × 로 닫았다 다시 열어도, 모름으로 끝난 뒤 닫았다 열어도 전액으로 돌아가지 않는다(`useDirectRefund` — 새 훅). 모름으로 든 키에는 10분 나이 제한을 적용하지 않는다(`IntentKeys.hold` — 운영자 환불만, 사용자 쪽 주문 만들기 · 환불 요청은 그대로). 모름에서 벗어나는 길: 같은 내용을 다시 보내 확정 답이나 성공을 받거나, 「결제사와 맞추기」가 끝난 뒤(`forget()`).
- **닫힌 창에서 끝난 오류가 성공처럼 보이지 않는다**: 일하는 중에 × 로 닫은 뒤 승인 · 거절 · 직접 환불이 오류로 끝나면 창이 다시 열려 그 말을 한다(`useRefundDecision` · `useDirectRefund` 의 `onError`).
- **영어 내부 문장이 토스트로 뜨지 않는다**: `RefundNotDoneError`(`refund rfd_… is FAILED`)는 전역 토스트에서 거른다 — 환불 창이 제자리에서 우리 낱말로 말한다.
- **승인의 409 · 400 이 막다른 길이 아니다**: 승인의 `409 REFUND_NOT_ALLOWED` 는 두 뜻이라(이미 결정됨 / 주문이 환불할 수 없거나 결제사에 결제가 없음) 「지금은 이 요청대로 환불할 수 없어요. 결제 한 건에서 상태를 확인해 주세요」로 중립으로 말하고, `400 REFUND_AMOUNT_EXCEEDED`(요청 줄은 `REQUESTED` 로 남는다)는 「요청을 거절하거나 결제 한 건에서 직접 환불해 주세요」 — 둘 다 결제 한 건으로 가는 길(`orderLink`)을 준다. 직접 환불의 `409 REFUND_IN_PROGRESS` 는 열린 것이 기다리는 요청(`order.openRefundStatus === 'REQUESTED'`)이면 「기다리는 환불 요청이 있어요. 그 요청을 먼저 결정해 주세요」.
- **운영자 환불 · 승인 호출은 45초를 기다린다**(`OPERATOR_REFUND_TIMEOUT_MS`, `createPaymentAdminApi(client, { refundTimeoutMs })`): 서버가 결제사 조회 + 환불을 하므로 클라이언트 기본 15초보다 길다. 거절은 돈이 안 움직여 기본 그대로다.
- **문서가 코드보다 넓지 않다**: 「402 · 400 · 409 = 확정」을 「장부 코드(`PAYMENT.*`)가 붙은 답만 확정, 코드 없는 4xx 와 `PROVIDER_NOT_FOUND` · `ROUTING_FAILED` 등은 모름」으로 고쳤고 `refundOutcome.test.ts` 가 그 경계를 고정한다. 운영자 API 가정 표를 진행 문서의 운영자 계약 추가 ①~⑥ 에 맞췄다.
- e2e(`paymentAdmin.e2e.ts`): `aria-disabled` 단추를 `click()` 하면 Playwright 가 「enabled 가 아님」으로 15초를 기다리다 실패하므로, 막힌 확인을 포커스 + Enter 로 누른다(「닿는다」도 같이 잰다). 두 e2e 파일과 `paymentSteps.ts` 의 다른 `click()` 은 모두 눌릴 수 있는 단추다. **작성만 했다 — 실행하지 않았다.**

### Fixed — 거둠도 끝나면 무효화한다, 문서와 작은 사실 맞춤 (F3 리뷰 2~3회차)

- **`useWithdrawRefund` 는 실패해도 뿌리를 무효화한다**: 환불 요청 거둠이 「이미 처리됨」으로 끝나도 화면이 서버의 지금 상태를 다시 읽는다. 거둠 · 승인 · 그만둠은 끝나면(실패 포함), 환불 요청도 끝나면(확정 거절 · 답 유실 포함 - R-FE 1회차부터) 무효화하고 주문 만들기는 하지 않는다. `packages/payment/README.md` 의 문장과 상수 표(`INTENT_KEY_TTL_MS`)를 맞췄다.
- **`apps/sample`**: 거둠이 이미 처리된 요청이라 막히면 그렇게 말한다(방향 없는 문구) · 거절된 뒤 다시 요청하면 옛 문구를 지운다 · 돌아온 화면은 주문 id 가 있는데 못 읽었으면(조회 중이든 실패든) 「다시 해 보기」를 감춘다 · 결제창이 안 열린 주문은 안 것으로부터 시간을 센다.

### Fixed — 운영자 환불이 아는 것만 말한다 (F4 리뷰 1회차)

- **결과를 모르는 오류를 「환불하지 못했어요」라고 단정하지 않는다**: `refundProblemOf(error)` 가 확정(장부 코드가 붙은 답 — 결제사 거절 · 409 · 400 · `503 PAYMENT.UNAVAILABLE` = 보내지 않았다 · 환불 없이 닫힌 줄)과 모름(네트워크 · 시간 초과 · 5xx)을 가른다. 모름은 「환불 결과를 확인하지 못했어요」 + 환불 내역 확인 안내(확인은 열려 있다), 승인의 409 는 「이미 처리된 요청이에요」, 거절의 모름은 「거절 결과를 확인하지 못했어요」.
- **`Idempotency-Key` 는 모를 때만 든다**: 확정 판정(장부 코드 `PAYMENT.*` 가 붙은 답 — 402 · 400 · 409 · 404 · 503 — 과 200 인데 `FAILED`/`REJECTED`/`WITHDRAWN` 줄; 코드 없는 4xx 와 `PROVIDER_NOT_FOUND` · `ROUTING_FAILED` 는 모름)에서는 놓아, 같은 금액으로 다시 누르면 새 환불 줄 · 새 키다. 같은 키 재전송이 돌려준 닫힌 줄은 성공처럼 창을 닫지 않고 실패로 말한다(`RefundNotDoneError`).
- **요청 승인이 결제사에 거절되면 막다른 길이 아니다**: 그 요청 줄은 닫힌다(스펙 §5.3) — 확인이 막히고(`aria-disabled` + 이유) 「요청은 환불 안 됨으로 닫혔어요. 결제 한 건에서 직접 환불해 주세요」, 목록에서 연 창은 결제 한 건으로 가는 링크(`orderLink`)를 준다.
- **채운 단추는 화면에 하나**: `AdminOrderPanel` 은 우선순위(기다리는 요청의 결정 → 확인 필요의 맞추기 → 환불하기 → 맞추기 → 막힌 환불하기)로 하나만 채우고, `RefundRequestTable` 의 줄 단추는 모두 테두리다. 상태별 스토리 `play` 가 채운 단추 수를 센다.
- **`useRefundDecision` 이 패키지로**(`@skeleton/payment/admin`, 샘플에서 이사): 스토리 `play` 가 베낀 코드가 아니라 진짜 훅을 잰다(승인은 `approve` 만, 거절은 `reject` 만). 일하는 동안 × 로 닫았다 다시 열어도 일하는 중이다(풀린 확인으로 승인이 두 번 나가지 않는다).
- **데이터가 있는데 다시 읽기만 실패하면 화면을 바꾸지 않는다**(운영자 한 건 · 내 결제 한 건 · 응원하기): 창 · 오류 · 멱등 키가 그 컴포넌트 안에 살기 때문에, 통째로 오류 화면으로 바뀌면 「모르는 오류에서 같은 키 재사용」이 깨졌다. 운영자 한 건 화면은 띠 + 「다시 시도」를 더한다.
- 단추 낭독 이름: 결정 단추는 금액 + 결제 번호, 「다시 처리」는 이벤트 이름 + 결제 번호(없으면 결제사 결제 번호). 요청 처리 창은 결제 번호를 한 줄로 말한다.
- `PAYMENT.WEBHOOK_EVENT_NOT_FOUND` 를 장부 오류 코드에 더하고 「꺼짐」 판정에서 「없음」으로 본다. `packages/payment/README.md` 의 「운영자 API 가정」 표를 백엔드와 정한 계약(C1~C8)에 맞췄다.
- e2e(`paymentAdmin.e2e.ts`): 늘 참이던 단정(`getByText('운영자')`)을 「운영자 · 운영자가 환불함」 순서로, 기다림 없던 「결제사 호출 0」을 브라우저가 보낸 환불 POST 수 + 조용해질 때까지 기다림으로 바꿨다. **작성만 했다 — 백엔드가 들어온 뒤 실행한다.**

### Added — `@skeleton/ui` `ChoiceGroup` (F3 리뷰 1회차)

- **`ChoiceGroup`**: 하나만 고르는 선택지 묶음(WAI-ARIA radio group) — 칸마다 보조 `Button`, 고른 칸은 ✓ · 굵게 · 안쪽 선, Tab 은 한 번(고른 칸), 화살표 · Home · End(`nextChoiceIndex`)가 고른 칸을 옮기고 포커스가 따라간다. 이름은 `aria-label` 또는 보이는 제목에 잇는 `aria-labelledby`. 안 고른 칸의 hover 는 고른 칸과 다른 모양. 스토리 + `play`(키보드 · 포커스 · a11y). `apps/sample` 의 `AmountChoice` 를 옮긴 것 — 샘플은 이것을 쓴다.

### Fixed — `apps/sample` 응원하기 (F3 리뷰 1회차)

- **결제창을 닫고 돌아온 화면이 틀린 말을 하지 않는다**: 실패 주소로 돌아오면 주소만으로 「그만뒀어요」 / 「결제가 안 됐어요」라 한다(「확인 중」 · 「내역에서 다시 볼 수 있어요」가 아니다). 서버가 돈이 움직였다고 할 때(`PAID` · `CONFIRMING` · 환불)만 그 말로 뒤집는다. `failUrl` 에 우리 주문 id(`?order=`)를 싣는다 — 결제창이 `orderId` 를 싣지 않아도 그 주문을 닫는다. 가짜 토스에 `sdk: 'cancel-no-order-id'`.
- **`PAYMENT.*` 오류는 토스트로 한 번 더 뜨지 않는다**(`toastUnlessValidation`): 화면이 제자리에서 말한다. 「요청 거두기」 실패에도 제자리 문구.
- **결제창을 못 열면 누를 때마다 새 주문이 생기지 않는다**: 만든 주문을 화면이 들고 있다가 같은 금액으로 다시 누르면 창만 다시 연다.
- **e2e**: 한 파일의 시나리오들이 로그인을 한 번만 한다(`ensureSignedIn` — 둘째 시나리오부터 「로그인」 링크가 없어 던지던 것) · 탐침은 404 만 건너뜀(그 밖의 실패는 던진다) · 백엔드에 `skeleton.http.clients.payment-toss.response-timeout=10s` 를 같이 싣는다(`reconcile.first-delay` 가드) · `checkout-ttl` 40s · ⑥ 은 이 주문의 호출만 센다 · ① 은 내역 줄의 카드 표시를 단정한다.

### Added — `@skeleton/payment/admin` 운영자 부품, `apps/sample` 의 운영자 결제 화면, e2e (F4)

- **`@skeleton/payment/admin`**(선택 하위 경로 — `@skeleton/auth/admin` 과 같다. 기본 진입점은 이것을 싣지 않는다): `createPaymentAdminApi`(`/admin/payments` — 목록 · 한 건 · 직접 환불 · 환불 요청 목록 · 승인 · 거절 · 「결제사와 맞추기」 · 웹훅 수신함 보기 · 다시 처리) · 훅 `useAdminOrders` `useAdminOrder` `useAdminRefundRequests` `useAdminWebhookEvents` `useOperatorRefund`(의도별 `Idempotency-Key`) `useApproveRefund` `useRejectRefund` `useSyncOrder` `useRetryWebhookEvent`(변경이 끝나면 사용자 쪽과 같은 뿌리 `['payment']` 를 무효화) · `adminAccessProblem`(403 접근 차단 / 404 운영자 경로가 꺼짐 — 결제 한 건이 없다는 404 와 코드로 가른다).
- **부품 다섯**: `AdminOrderTable`(표 · 확인 필요 알약과 이유 · 상태 고르기 · 결제 번호 찾기) · `AdminOrderPanel`(한 건 — 결제사 결제 번호 · 환불 줄 · 이력 · 직접 「환불하기」 · 「결제사와 맞추기」, 주 단추는 하나) · `AdminRefundDialog`(직접 환불 전액/부분 · 요청대로 환불 · 요청 거절 — 돈이 나가는 행동은 늘 이 확인 창, 남은 금액을 넘는 금액은 화면에서도 막고 막힌 확인은 `aria-disabled` + 이유) · `RefundRequestTable`(결정을 기다리는 줄에 채운 단추 하나) · `WebhookEventTable`(처리되지 못한 줄에만 「다시 처리」). 줄 끝 행동은 모두 테두리 있는 단추이고 `renderAction` 링크에는 버튼 모양 클래스를 붙인다. 스토리 다섯 파일(`play` · 접근성 · 320/375px · 영어) · 마크업 시험 · 한국어 문구에 영어가 남지 않는 시험.
- **문구**: `PaymentLabels.admin`(`koPaymentLabels.admin`) — 낱말은 스펙 §11.2 한 벌(운영자 키까지 `labels.test.ts` 가 「쓰지 않는 말」을 막는다: 돈을 돌려주는 일은 「환불」 하나, 「승인」 · 「반려」 · 「동기화」 없음, 「결제사와 맞추기」, 「확인 필요」).
- **`apps/sample`**: `/admin/payments`(탭 전체 · 확인 필요 · 환불 요청, `?tab=` 에 남는다) · `/admin/payments/:id`(한 건) — `RequireRole ADMIN` 아래, 서버 403 은 「접근 차단」 · 404 는 「결제 관리를 쓸 수 없어요」. `admin.payments.*`(ko · en)은 낱말 시험(`cheerWording.test.ts`)이 본다. 메뉴 링크는 두지 않았다(계정 도구와 같다) · 웹훅 수신함은 화면에 두지 않았다(부품만).
- **e2e**: `payment.e2e.ts` ①의 운영자 환불 걸음이 API 호출에서 운영자 화면 조작(별도 로그인 컨텍스트 → 환불 요청 탭 → 「요청대로 환불하기」 → 확인 창)으로 바뀌었다. 새 `paymentAdmin.e2e.ts`: ⓐ 운영자만 들어간다 ⓑ 부분 환불(남은 금액을 넘으면 막힘 → 2,000원 환불 → 「일부 환불됨」, 결제사 취소 한 번 · 금액 2,000) ⓒ 요청 거절(사용자에게 「환불 안 됨」, 결제사 호출 없음) ⓓ 「결제사와 맞추기」. 운영자 경로가 닫힌 백엔드에서는 건너뛴다. **작성만 했다 — 백엔드 B7 · B8 이 들어온 뒤 실행한다.**
- `capabilities.json`: 항목 `payment-admin`(패턴) · `payment` 의 「운영자 화면은 아직 없다」 안내를 하위 경로로 고쳤다. `backend.modules` 에 `payment-jdbc` 는 아직 없다(kotlin main 에 들어온 뒤).
- **운영자 API 는 가정이다** — 스펙 §7 이 모양을 다 정하지 않아 `packages/payment/README.md` 의 「운영자 API 가정 — 백엔드 B7 이 맞출 것」에 경로 · 쿼리 · 응답 칸 · 오류 코드를 적었다.

### Added — `apps/sample` 응원하기: 금액 고르기 → 결제창 → 결과 → 내 응원 내역 → 환불 요청, 가짜 토스, e2e (F3)

- **화면**: `/cheer`(서버가 준 금액 목록에서 하나 — `@skeleton/ui` 의 `ChoiceGroup`(보조 `Button` 모양의 선택지), 고른 것은 테두리 · 바탕 · ✓ — 와 채운 단추 「응원하기」 하나, 테스트 키면 `TestModeNotice`, 못 쓰면 흐리게 두고 이유) → 결제창(`openCheckout`) → `/payments/return`(성공 · 실패 주소 둘 다 읽어 같은 주문의 승인을 한 번, `PaymentResult`) → `/cheers`(내 응원 내역 — `OrderList`) → `/payments/:id`(`OrderSummary` + 환불 요청 `RefundRequestDialog`). 메뉴에 「응원하기」, 설정에 「내 응원 내역」 링크 카드. 모두 `RequireAuth` 아래 · `noindex` · robots 에서 막음. 문구 `cheer.*`(ko · en)는 낱말 시험(`cheerWording.test.ts`)이 「쓰지 않는 말」을 막는다.
- **`apps/sample/src/cheer/`**: 응원 API(`GET /cheers/options` · `/cheers/me`) · 쿼리 훅 · `startCheer`(주문 → 결제창, 창을 닫으면 주문을 돌려놓는다) · `returnPlanOf`(돌아온 주소 → 할 일) · `shownOrderOf` · `cheerAsOrder` · `paymentLabelsFor`(패키지 문구 위에 응원 말만 덮는다).
- **`e2e/fakeToss.ts`**: 토스 문서 모양의 가짜(승인 · 취소 · 조회, Basic 인증 · 멱등 키 · 금액 대조) + 제어 `POST /control`(다음 승인을 거절 · 지연 · 유실 · 5xx, 결제창을 닫음 · 인증만 하고 떠남, 나중에 결제를 끝냄, 카드 번호) + 토스 SDK 대역 스크립트(`routeTossSdk` 가 `js.tosspayments.com` 요청을 가로챈다). 단위 시험 `fakeToss.test.ts`. `globalSetup.ts` 가 기본으로 띄워 백엔드에 `SKELETON_PAYMENT_TOSS_*` 로 알린다(`E2E_FAKE_TOSS=0` 이면 끈다).
- **`e2e/payment.e2e.ts`**: 스펙 §13.2 ①~⑦(결제 → 내역 → 환불 요청 → 운영자 환불 · 떠난 결제의 뒤늦은 정합 · 금액 변조 · 카드 거절 · 승인 응답 유실 · 새로 고침 · 그만둠). 백엔드에 응원하기가 없으면 건너뛴다. 운영자 환불은 운영자 화면(F4) 전이라 API 로.
- `capabilities.json`: `app-sample` 이 `payment` 를 끌고 온다(`autoIncludes`) · `payment` 의 `alsoVia` 에 `--with-sample`.

### Fixed — `@skeleton/payment` 막힌 환불 확인도 Tab 으로 닿는다, 환불된 결제의 결과 화면에 「결제 내역」(F2 리뷰 2회차)

- **`ConfirmDialog` 에 `confirmBlockedBy`**(더하기만 — 기존 prop 동작 그대로): 창 안에서 왜 못 누르는지 말하는 요소의 id 를 주면 확인이 `aria-disabled="true"` 로 흐리게 남고, Tab 으로 닿고, 눌러도 아무 일 없고(문구 입력 창에서도 제출하지 않는다), 그 요소가 단추 설명으로 낭독된다. `busy` 는 정말 일하는 중이라 그대로 `disabled`. 스토리 `BlockedConfirmStaysReachable`.
- **`RefundRequestDialog`**: `REFUND_IN_PROGRESS` · `REFUND_NOT_ALLOWED` 뒤와 환불할 금액 0 일 때 확인 단추가 꺼지지 않고 막힌 채 닿는다 — 이유 띠(`Alert`)가 단추 설명이다. 스토리 `ErrorRefundAlreadyOpen` · `ErrorRefundNotAllowed` · `NothingLeftToRefund` 가 `aria-disabled` · 닿음 · 설명을 단정한다. 「일하는 중이 아닌데 진짜 `disabled`」인 단추를 `packages/payment` 전체에서 훑었으나 더는 없었다(남은 `disabled` 는 `loading` 이 거는 것뿐).
- **`PaymentResult`**: `REFUNDED` 가 자기 단계가 되면서 빠졌던 「결제 내역」 단추를 되살렸다(스토리 `Refunded` 와 `ui.test.tsx` 가 단정).

### Fixed — `@skeleton/payment` 결제 결과의 세 갈래: 모르면 다시 보내고, 거절은 거절, 확정 4xx 는 따로(F1 확인 리뷰 2회차)

- **결과를 모르면 같은 주문의 승인을 다시 보낸다**: `useConfirmOrder`(`confirmOrderMutation`)가 네트워크 오류 · 시간 초과 · 5xx · 401 갱신 실패에 `CONFIRM_RETRY_LIMIT`(5)번, 1초에서 두 배씩 10초까지 다시 보낸다(그동안 `isPending`). 서버 계약이 받쳐 준다 — `CONFIRMING` 이면 202, `PAID` 면 200, 결제사 멱등 키 = 주문 id. 전에는 승인 요청이 서버에 닿지 못해 `PENDING` 이던 주문이 영원히 「확인이 늦어지고 있어요」였다(되묻기는 `PENDING` 을 묻지 않고, 결제 내역은 `PENDING` 을 빼고 준다).
- **`confirmOutcomeOf(error)`**: `declined`(402 `DECLINED`) · `rejected`(그 밖의 확정 4xx: 400 `AMOUNT_MISMATCH` · 409 `MODE_MISMATCH` · 409 `ORDER_NOT_PAYABLE` · 404) · `unknown`(그 밖 전부). 확정된 답은 다시 보내지 않는다.
- **`PaymentResult` 에 단계 하나**: 「결제를 확인하지 못했어요」(`result.unconfirmed`) — 확정 4xx 이고 주문이 아직 끝나지 않았을 때. 스피너도 「다시 해 보기」도 없고 「결제 내역」 + 참조 번호. 서버가 읽어 준 주문이 끝 상태면 그 상태가 오류를 이긴다. 다시 보내고도 끝내 모르면 곧바로 「확인이 늦어지고 있어요」다(전에는 모르는 오류가 30초 스피너였다).
- **되묻기 상한은 시계로 잰다**: 조회가 계속 실패해도 `Date.now() - 첫 답` 이 상한을 넘으면 멈춘다. 조회 하나가 실패해도 간격이 1초로 돌아가거나 5분 시계가 다시 돌지 않는다(회차 사이의 공백은 `errorUpdatedAt` 도 센다).
- **든 `Idempotency-Key` (`createIntentKeys`)**: 성공한 호출은 **자기가 쓴** 키만 버린다(그 사이 다른 입력으로 넘어갔다면 그 입력의 키가 남는다), 든 키에 수명 10분(`INTENT_KEY_TTL_MS`, 결제창 유효 시간 30분보다 짧게). 키 시험을 응답 전에 두 번 누르는 상황 · 다시 그려도 같은 키인지(스토리 `RetryAfterAFailureKeepsTheSameKey`)까지 넓혔다.
- **`loadTossPaymentsSdk`**: 포기한 시도의 늦은 `load`/`error` 가 그 뒤에 시작한 새 시도의 기억을 지우지 않는다. `readCheckoutReturn` 과 같게 `confirmRequestFromTossRedirect` 의 오류 문장도 주소의 금액 날값을 싣지 않는다.
- **README**: 결과 화면에서 승인 · 다시 보내기 · 단계 판정을 엮는 예시, `press()` 가 끝날 때까지 단추를 막는 예시(`disabled={create.isPending}` 은 주문이 만들어진 뒤 결제창이 뜨기 전 틈에 단추를 다시 연다). 맨 위 「kotlin 병합 뒤 할 일」 메모는 아래로 옮겼다(찍힌 프로젝트의 README 에 따라가지 않게).
- **kotlin 병합 뒤 할 일 (잊지 말 것)**: 백엔드 `payment-jdbc` 가 kotlin-skeleton 에 들어오면 `capabilities.json` 의 `payment` 항목 `backend.modules` 에 `payment-jdbc` 를 더하고, 같은 때 `backend.basePaths` 를 `["/api/v1/payments"]` 로 채운다. 지금 `basePaths` 는 `[]` 다 — 적힌 모듈(`payment`)이 열지 않는 경로를 적으면 `siblingCheck` 가 짝 경로가 없다며 검사를 건너뛰어 빈틈으로 통과한다.

### Fixed — `@skeleton/payment` 화면 부품: 링크는 버튼 모양, 영어가 안 남는다, 요청만 한 환불은 「환불 요청함」, 꺼진 단추도 Tab 으로 닿는다(F2 리뷰 1회차)

- **버튼 모양 링크**: `OrderList` 의 `renderAction` 이 네 번째 인자로 버튼 모양 클래스를 준다(작은 보조 `Button` 과 같은 테두리 · 높이 · hover · 포커스). 정본 스토리 `LinkAction` · README 예시는 링크에 그 클래스를 붙이고, `play` 가 테두리 · 바탕 · 높이를 단정한다. 없던 `<LinkButton>` 을 쓰라던 문구는 없앴다(`@skeleton/ui` 로 올리지 않았다).
- **한국어 문구를 넘기면 영어가 남지 않는다**: `ConfirmDialog` 에 `loadingLabel`(`@skeleton/ui`, 기본 `Loading` 그대로) — 환불 창 확인 단추의 「Loading 환불 요청하기」. 오류 알림의 낭독 말머리(`labels.errorLabel`) · 「더 보기」의 스피너 · 「거두는 중」 · × 단추(`창 닫기`). 낱말 시험이 `labels` 객체만 훑던 빈틈은 `ui.test.tsx` 가 한국어로 그린 마크업(태그를 벗긴 글자 + `aria-label`)에서 `Error|Loading|Close|Copy|Reference|…` 를 찾는 것으로 메웠다.
- **환불을 요청만 한 상태**: 계약에 `Order.openRefundStatus?: 'REQUESTED' | 'PENDING' | null`(백엔드가 맞춘다 · `refundPending` 은 그대로). 알약 · 요약은 `REQUESTED` → 「환불 요청함」(돈은 안 움직였다), `PENDING` → 「환불 중」, 칸이 없는 서버는 `refundPending` 만으로 「환불 중」. `OrderSummary` 는 환불 줄 중 열린 줄의 상태를 먼저 쓴다(머리 알약과 줄이 어긋나지 않는다). 막힌 이유도 「이미 환불을 요청했어요」 / 「환불 중이에요」로 갈린다.
- **「요청 거두기」**: `OrderSummary` 의 `onWithdrawRefund?(refund)` · `withdrawing?` — 내가 요청한(`REQUESTED` · `USER`) 줄 옆 테두리 단추. 상태 낱말은 「환불 요청 거둠」(「그만둠」은 결제창 이탈에만).
- **못 누르는 단추**: `aria-disabled="true"` + 눌러도 아무 일 없음 + 옆에 이유 한 줄(`aria-describedby`) — Tab 으로 닿고 이유가 낭독된다. `docs/ui-catalog.md` 의 원칙 절(「꺼진 버튼으로 막지 않는다」)과 `OrderSummary` 줄이 서로 맞게 다듬었다. 서버 설정(`refundRequestsEnabled`)을 아직 모르면(`undefined`) 단추를 그리지 않는다 — 켜졌다 꺼지는 단추가 없다.
- **환불 창**: 닫는 단추 「취소」 → 「닫기」(× 는 「창 닫기」) — 낱말 시험의 「취소」 예외가 없어졌다. 창이 보인 금액을 `amount` 로 보낸다. `REFUND_IN_PROGRESS` · `REFUND_NOT_ALLOWED` 뒤와 환불할 금액 0 이면 확인 단추가 막힌다(2회차에서 꺼짐 → `aria-disabled` 로 닿게 고쳤다). 묵은 오류는 부모가 열 때 `reset()`(README).
- **결과 화면**: 환불된 주문은 「환불됐어요」, 이름과 금액은 따로 칸, 겹쳐 읽히던 `role="status"` 중첩을 걷고 제목에 `aria-describedby`, 다른 주문으로 바뀌면 「늦어지고 있어요」도 처음부터. `OrderList` 는 불러오는 중 · 오류여도 받은 줄을 지우지 않는다.
- **문구**: 모르는 상태는 영문 코드 대신 「확인 필요」, 「돈은 나가지 않았어요」(단정)는 「결제가 끝나지 않았어요」, 「다시 해 보세요」/「다시 불러오기」 통일, 운영자 · 결제사 콘솔이 한 환불의 사유 문구 두 개, 같은 문장이 두 키에 있던 것(환불 막힘 이유)은 `refundBlocked` 하나. 문구 파일은 `labelTypes.ts` · `labels.en.ts` · `labels.ko.ts` 로 갈랐다(공개 이름은 그대로). 낱말 시험은 공백을 뗀 글자로 붙여 쓴 변형(「처리중」 · 「테스트모드」)을 잡고, 「결제 내역」 · 「환불 요청」 같은 긍정 단정을 더했다. 표 조회는 자기 키만(`Object.hasOwn`) — `constructor` 같은 코드가 와도 함수가 글자로 나오지 않는다.
- **좁은 폭**: `PaymentResult`(참조 번호가 붙는 단계, 영어도) · `RefundRequestDialog`(뷰포트 설정 320/375, 영어도) 스토리. 공백 없는 긴 영문 이름이 `Card` 머리에서 넘치던 것을 고쳤다(`@skeleton/ui` `Card` 의 제목이 줄을 바꾸고 `actions` 는 아래로 — 스토리 `UnbreakableTitleStaysInside`).

### Added — `@skeleton/payment` 화면 부품 여섯 개(F2)

- `OrderStatusBadge`(눌리지 않는 알약 · 열린 환불이면 「환불 중」) · `OrderList`(결제 내역 — 줄 끝 「자세히」 단추만 눌린다, 카드 표시 「현대카드 ····1234」) · `PaymentResult`(됐어요 / 확인 중 / 늦어지고 있어요 / 안 됐어요 / 시간이 지났어요 / 그만뒀어요 — 거절 종류별 문구, 결제사 코드는 `ErrorReference` 안에만) · `OrderSummary`(한 건 + 환불 줄 + 「환불 요청」, 못 누르면 이유를 옆에) · `RefundRequestDialog`(사유 고정 셋 · 확인/취소) · `TestModeNotice`.
- 문구는 `labels` prop(기본 영어 · `koPaymentLabels`), 낱말은 스펙 §11.2 의 한 벌 — 「쓰지 않는 말」이 기본 문구에 없음을 `labels.test.ts` 가 고정. 도우미 `formatMoney` · `cardDisplay` · `declineCategoryOf`.
- 스토리 여섯 파일(`play` · 접근성 · 320/375px) · `docs/ui-catalog.md` 여섯 줄 · `tests/support/ssrFixtures.ts` · `capabilities.json`(`needs` 에 `time` `ui`). 런타임 의존에 `@skeleton/ui` · `@skeleton/time` 추가.

### Added — `@skeleton/payment` 장부 API · 훅 · 결제창 열기(F1)

- `createPaymentLedgerApi(client, { basePath = '/payments' })`(주문 만들기 · 승인 · 그만둠 · 한 건 · 내역 · 환불 요청 · 거둠, 만들기 · 환불 요청은 `Idempotency-Key`) · 훅 `usePaymentConfig` `useCreateOrder` `useConfirmOrder`(결과를 모르면 같은 주문의 승인을 다시 보낸다 — 아래 「Fixed」) `useAbandonOrder` `useOrder`(`CONFIRMING` 동안만 간격을 늘려 되묻고 첫 답으로부터 5분이면 멈춘다) `useOrders` `useRequestRefund` `useWithdrawRefund`(키는 한 뿌리 `paymentKeys.all`; 환불 요청은 성공하면, 거둠 · 승인 · 그만둠은 끝나면(실패 포함) 뿌리를 무효화하고, 주문 만들기는 무효화하지 않는다 · `useCreateOrder` / `useRequestRefund` 는 한 의도의 `Idempotency-Key` 를 들고 있다 — 성공하면 그 키만 버리고 10분이 지나면 새로 만든다 · 승인 호출은 45초까지 기다린다) · `openCheckout`(토스 SDK v2 를 누른 그때 불러온다, 구매자 정보 없음, SSR 안전) · `readCheckoutReturn` · 장부 오류 코드 열네 개(`PaymentLedgerErrorCodes` `isPaymentLedgerError` `declineDetail`). 기존 `createPaymentApi` · `confirmRequestFromTossRedirect` · `isPaymentError` 는 그대로. 부품(F2) · `@skeleton/payment/admin`(F4)은 아직 없다. 백엔드 짝은 kotlin-skeleton `feat/payment-ledger`(`payment-jdbc` 가 들어오면 `capabilities.json` 의 `backend.modules` 에 더한다).

### Fixed — 이메일 등록 · 약관 재동의 막이 한 계정의 것이 된다, 독립 리뷰 반영(`@skeleton/auth` · `@skeleton/legal` · `@skeleton/realtime` · `apps/sample`)

- **계정 바뀜**: 두 컨트롤러에 `setAccount(accountId)` — 게이트가 매번 알린다. 계정이 **바뀌면**(다른 탭이 B 로 로그인 · 로그아웃; 토큰 저장소는 탭끼리 동기화된다) 이전 계정의 막이 접히고 붙잡힌 호출은 원래 403 으로 끝난다(B 의 토큰으로 나가지 않는다). 로그아웃 뒤에 늦게 온 403 은 막을 다시 세우지 않는다. 막이 열려 있는 동안 탭이 다시 보이면(visibilitychange · focus) 서버에 다시 묻는다 — 다른 탭에서 이미 등록 · 동의했으면 접고 붙잡은 호출을 보낸다(`reconsent.check()` 는 더는 묻지 않으면 닫는다). `ReconsentGate` 의 `deferCheck`: 앞 단계가 끝나야 묻는 앱이 계정을 숨기지 않고 확인만 미룬다.
- **이메일 필수를 안 켠 앱**: 주소 없는 소셜 계정은 예전처럼 제공자 단추가 바로 나온다(403 을 한 번 맞고서야 나오지 않는다), 힌트 문구 `emailAddHintReauth`. 필수 앱의 「서버가 말할 때만 제공자」 순서는 그대로. ko `emailReauthNeeded` 는 조사를 붙이지 않는다.
- **실시간 알림**: 막이 걷히면(`required → idle`) 403 으로 멈춘 스트림을 다시 잇는다(sample `subscribeGateRelease` — 토큰이 바뀌지 않는 이유로 풀린 403 이라 `subscribeAuthChanges` 만으로는 깨어나지 못했다). `subscribeAuthChanges` 의 뜻을 「다시 이어도 되는 때」로 넓혔다. 403 은 계속 `off`(진짜 권한 오류와 구분할 수 없다) — 풀렸다는 신호는 막의 주인이 준다.
- **그 밖**: `/account#delete` 같은 해시가 가리키는 구역으로 스크롤하고 제목에 포커스 · 막이 닫히면 열리기 전의 포커스 복원(`useRestoreFocus`) · 새로고침해도 `me.pendingEmail` 로 인증번호 단계 복원 · 쓸 수 있는 제공자가 없으면 「다시 시도」 · 제공자 목록을 앱이 켠 것으로 거른다(`enabledProviders`) · 인증번호 안내문에서 하드코딩 「10분」 제거(남은 시간은 카운트다운이 말한다) · `me.contactEmail` 키가 없으면 연락받을 이메일 구역을 그리지 않는다(키 없음 = 꺼짐, null = 아직 없음; 옛 서버는 404 로 사라지던 길이 남아 있다) · `flow.providerOfFailure(error)`(모듈 전역 WeakMap 이던 `providerOfFailure` 를 흐름 인스턴스로) · 로그아웃하면 끝난 소셜 로그인의 응답을 비운다 · 안 쓰는 라벨 `emailRequiredDone` 삭제 · `ContactEmailSection` · `EmailRequiredScreen` 분리.
- **api-client 동작 기록**: 한 요청은 **401 복구(토큰 갱신) 뒤에 403 복구**를 이어 받을 수 있다 — 갱신한 토큰으로 다시 보냈더니 이번엔 403(이메일 · 약관). 각 복구는 요청당 한 번, 같은 코드의 403 은 한 번 풀었으면 다시 풀지 않는다.
- **e2e**: `registerEmailViaGate` · `acceptLegalGate` 는 막이 뜰지를 서버(`GET /account/me` 의 `emailRequired`, `GET /legal/consents/me` 의 `blocked`)에게 먼저 묻고, 뜬다고 하면 삼키지 않고 기다린다(안 뜨면 실패). 「없다」를 고정 대기로 확인하던 곳은 요청이 끝났다는 신호(네트워크 유휴 · 뒤따른 메일)로 바꿨다. 막의 로그아웃 · 계정 삭제 단추를 눌러 끝까지. `emailReauth.e2e.ts` 는 표준 구성에서 돈다(두 번째 브라우저 컨텍스트가 같은 계정으로 로그인해 첫 세션을 `DELETE /auth/sessions?keepCurrent=true` 로 닫으면 그 세션의 첫 등록은 `REAUTH_REQUIRED` → 제공자 재동의 → 인증번호). 「이미 계정이 있나요?」(빈 계정 지우기 → A 로 로그인 → LINE 연결 → LINE 로 A 에 로그인)도 `emailRequired.e2e.ts` 에서 끝까지.

### Added — 이메일 필수: 「이메일을 등록해 주세요」 전면 화면, 계정 이메일 · 연락받을 이메일 두 구역(`@skeleton/auth` · `@skeleton/api-client` · `@skeleton/ui` · `apps/sample`)

백엔드(kotlin-skeleton `feat/email-required`, `docs/account-http-contract.md` 의 FINAL-6)에 맞췄다. 주인 결정: 「이메일은 받아야지. 있는 건 자동으로 등록하고, 없으면 강제로 입력하게 시키고, 추가 가능하게」 · 「복수 이메일이라는 건 연락받을 이메일」 · 「계정 이메일은 무조건 하나」. 둘 다 앱의 선택이라 **기본은 꺼짐**(sample 은 켠다).

- **등록 강제 화면** — `createEmailRequiredController()`(403 `ACCOUNT.EMAIL_REQUIRED` 를 붙잡았다가 등록되면 같은 호출을 다시 보낸다) · `<EmailRequiredGate>`(아래를 `inert` 로 두고 `EmailRequiredScreen` 이 덮는다 — 제목 「이메일을 등록해 주세요」 · 주소 → 인증번호(서버 `expiresAt`/`resendAvailableAt`) → 끝 · 「번호가 안 오면…」 안내 · 주소 고치기 · 로그아웃 · 「내 계정 삭제」) · `isEmailRequiredError`(전역 토스트에서 뺀다 — 쿼리 · 뮤테이션 모두). 이메일 막은 약관 막 바깥이라 한 번에 하나, 순서는 서버와 같은 이메일 → 약관 → 닉네임(약관 막은 `emailRequired.isReady()` · 등록 여부를 보고 그 뒤에 묻는다 — sample `LegalGate`). 현재 세션은 유지되고 다른 세션만 닫힌다(서버 `revokeAll(account, currentSession)` 로 확인).
- **1시간이 지난 첫 등록** — `403 REAUTH_REQUIRED` → 「보안을 위해 {제공자}로 한 번 더 확인해 주세요」 + 채운 단추 → 계정 설정이 열리자마자 제공자 동의(`emailReauthState`) → 돌아오면 이메일 구역이 인증번호를 이어 보낸다. `EmailSection` 은 주소 없는 계정의 첫 등록에 다시 인증을 먼저 내밀지 않는다(전에는 제공자 단추가 먼저였다).
- **api-client**: `ErrorCodes.ACCOUNT_EMAIL_REQUIRED` · `chainForbiddenRecovery(...)`(이메일 → 약관을 한 `recoverForbidden` 으로) · **다시 보낸 호출이 다른 이유로 또 403 이면 한 번 더 푼다**(전에는 어떤 403 이든 한 번뿐이라, 이메일 등록 뒤에 약관 403 이 오면 막혔다. 같은 이유는 여전히 한 번).
- **설정의 두 구역** — 「계정 이메일」(로그인 · 비밀번호 찾기 · 보안 알림에 쓰인다는 한 줄 · 이메일 필수 앱은 「지울 수 없고 바꿀 수만」) / 「연락받을 이메일」(`ContactEmailSection`, `settings.contactEmail`: 선택 · 공지/서비스 알림용 · 등록 = 주소 → 그 주소로 간 인증번호 · 바꾸기 · 지우기 · 없으면 「계정 이메일로 받아요」 · 서버 404 면 구역이 사라진다). `me.contactEmail` · `me.emailRequired` · `accountApi.requestContactEmail/confirmContactEmail/removeContactEmail`. 이메일 등록 전에 설정을 열면 이메일 등록과 계정 삭제 구역만(나머지는 서버가 403).
- **ui**: `CodeEntry` 의 여섯 칸이 좁은 폭에서 줄어든다(320px 화면의 카드 안쪽 ≈ 250px 에서 가로로 밀렸다) — 스토리 `FitsAnArrowColumn`.
- **sample**: 앱 맨 위 `EmailGate`(+`api/emailRequired.ts`), 설정 요약에 「계정 이메일」 · 「연락받을 이메일」, 소셜 가입 직후는 이메일 → 약관 → (닉네임: 막지 않는 띠 + 글쓰기 전 확인) 한 줄. 라벨 `sectionEmail` 은 「계정 이메일」(영어 Account email)로 바뀌었다.
- 가짜 `createFakeAccountApi({ emailRequired, takenEmails, reauthWindowExpired, firstRegistrationOpen, contactEmail, contactEmailOff })`, 스토리 `Patterns/Auth/Email required`(입력 → 코드 → 완료 · 이미 쓰인 주소 · 1시간 뒤 재동의 · 길 · 한국어 · 320/375px) 와 `Account settings` 의 새 스토리, e2e `emailRequired.e2e.ts`(가짜 LINE 주소 없음 → 강제 화면 → 메일함 코드 → 약관 → 홈 → 게시판 API · 연락받을 이메일 등록 · 삭제 · 비밀번호 찾기에 연락받을 이메일을 넣으면 메일이 안 온다) · `emailReauth.e2e.ts`(`E2E_EMAIL_REAUTH_WINDOW=PT0S` 실행에서만) · 기존 `social.e2e.ts` 는 주소 없는 LINE · X 가 먼저 이메일을 등록하도록 고쳤다.

### Changed — 소셜 로그인 · 연결 · 다시 인증이 콜백의 `state` 를 같이 보낸다(`@skeleton/auth`)

백엔드(kotlin-skeleton `chore/ops-docs`, `docs/account-http-contract.md` 의 `state?`)가 로그인 · 연결 · `socialReauth` 요청 본문에 선택 필드 `state` 를 받는다. Naver 는 토큰 발급에 인가 단계의 `state` 가 필요할 수 있어 백엔드가 받은 값을 Naver 토큰 요청에만 싣고, 다른 제공자는 무시한다.

- **모든 제공자에** 콜백 주소로 돌아온 `state`(비교를 마친 값)를 인가 코드와 함께 `state` 로 보낸다 — 로그인(`session.socialLogin` 의 `proof`), 연결(`accountApi.linkSocial` 의 `proof`, 최상위), 재인증(`socialReauth.state`). `SocialProof` 에 선택 필드 `state?` 가 늘었을 뿐 `AuthApi` · `AccountApi` 메서드 시그니처는 그대로(호환)다.
- `state` 는 로그 · 오류 · 에러 리포트에 싣지 않는다. 다른 제공자의 다시 인증에 걸쳐 연결을 이어 가는 왕복(`link-reauth`)에서는 먼저 받은 코드와 함께 이미 쓰인 `state` 가 그 왕복의 세션 저장소 기록에만 잠깐 있고, 완료 때 지워진다.
- 테스트: `social.test.ts` · `socialPkce.test.ts` · `socialLink.test.ts` · `authApi.test.ts` · `accountApi.test.ts`, 스토리 `SocialCallbackKeepsTheWantedPage` · `LinkCallbackCarriesTheProofBackToTheSettings` · `LinkAfterReconsentLinksOnceEvenUnderStrictMode`.

### Changed — 같은 이메일의 소셜 로그인은 자동으로 붙이지 않는다: 안내 화면과 연결 이어 주기(`@skeleton/auth` · `apps/sample`)

백엔드(kotlin-skeleton `fix/google-email-authority`)가 메일로 가입한 사람이 같은 메일의 소셜로 처음 로그인하면 `409 ACCOUNT.SOCIAL_EMAIL_CONFLICT`(`data` 없음)를 주도록 바뀐 데 맞췄다. 주인 결정 — 「그냥 연동 안 해주고 지가 등록하게」.

- **막다른 오류 → 안내 화면**: 전에는 일반 경고 한 줄(「같은 이메일의 계정이 이미 있어요 …」)과 글자 링크였다. 이제 제목 「이미 이 이메일로 가입한 계정이 있어요」 / 본문 「가입할 때 쓴 방법(이메일과 비밀번호, 이메일 링크, 다른 소셜)으로 로그인한 뒤, 계정 설정의 '로그인 수단'에서 'Google 연결'을 누르면, 다음부터 Google 로그인도 쓸 수 있어요.」(제공자 이름 뒤에 조사를 붙이지 않는 문장 구조) / 주 단추 「로그인하러 가기」 · 보조 단추 「처음으로」. `SocialCallbackScreen` 의 새 prop `homeTo` · `linkTo` · `provider`(없으면 옛 모양 — 계정 연결 콜백의 충돌은 뜻이 달라 그대로). **`AuthLabels` 변경**: `callbackConflictBody` 가 문자열이 아니라 `(providerName) => string`, 새 키 `callbackConflictSignIn` · `callbackConflictHome` · `callbackConflictUnknownProvider` · `methodLinkContinue`(번역을 쓰는 앱은 키를 더한다). 제목 문구도 바뀌었다.
- **이어 주기**: 「로그인하러 가기」로 로그인하면 `/account#methods` 로 가고, 로그인 수단 구역이 「Google 연결을 이어서 하세요」 한 줄 + 강조 테두리와 포커스가 간 그 제공자의 「연결」 단추를 보인다(`AccountSettings.linkIntent` · `SignInMethodsSection.linkIntent` · `SocialButtons.highlight`). 의도(어느 제공자)는 router state(`linkIntentState` · `linkIntentOf`)로만 옮긴다 — 저장소 · 주소 쿼리에 넣지 않는다. 돌아갈 곳은 로그인 화면이 이미 읽는 `state.from` 이라 `safeReturnPath` 검사를 거친다. 이미 연결됐거나 앱이 안 켠 제공자면 아무것도 더하지 않는다. 어느 제공자였는지는 `flow.providerOfFailure(error)`(거절된 `flow.complete` 의 오류를 제공자와 따로 기억한다).
- 로그인 화면의 이메일 칸은 미리 채우지 않는다(콜백이 이메일을 주지 않는다 — 테스트로 고정).
- **이메일 없는 계정**(주소를 안 주는 Google 등 `me.email` null): 계정 설정은 이미 「이메일 주소가 없어요」 + 새 주소 추가(제공자 동의를 다시 거침)로 그렸다 — 스토리 `EmailLessGoogleAccount` 로 고정. `apps/sample` 의 설정 카드는 빈 줄(—)이었는데 「이메일 없음」 + 「이메일 추가」 단추(`/account#email`)로 바뀌었다.
- 가짜 `createFakeAuthApi({ socialEmailConflict })`, 스토리 `Patterns/Auth/Social email conflict`, 라우트 스토리 `SocialEmailConflictGuidesToTheLinkInTheSettings`(콜백 → 로그인 → 강조된 연결 단추).

### Added — `@skeleton/author-profile` (작성자 프로필)

새 패키지. 백엔드 짝 `author-profile` 모듈(`/author-profiles`). 문구는 모두 `labels` prop(기본 영어). **`@skeleton/board` 를 import 하지 않는다**(`@skeleton/api-client` · `@skeleton/ui` 에 기댄다) — 보드와는 `authorPicker` 렌더 prop 한 곳(`AuthorPickerSlotProps` ↔ 보드의 `AuthorPickerArgs`)에서 만난다.

- **API · 훅**: `createAuthorProfileApi` · `useAuthorProfiles` · 만들기 · 이름 바꾸기 · 삭제 훅(끝나면 목록 무효화, `alsoInvalidate` 로 게시판 캐시도). `name` · `tag` 는 `string | null`(이름 없는 옛 글의 첫 프로필 · 꼬리표가 꺼진 서버) — `profileDisplay(profile, unnamed?)`. `ErrorCodes.AUTHOR_PROFILE_*`.
- **`AuthorPicker`**(게시판 `authorPicker` 에 꽂는다): 접힌 상태는 고른 `이름#꼬리표` 하나 — 긴 이름은 이름만 말줄임이고 꼬리표는 고정(접힌 단추 · 메뉴 항목 · 확인 단추 같은 구조). 처음 값은 이 스레드에서 쓴 프로필(①) → 이 기기가 기억하는 프로필(②) → 비어 있음 — 단 댓글을 받는 중(`threadLoading`)에는 확정하지 않고 단추를 잠근다. 스스로 채운 값은 출처를 기억해, **기억(②)에서 온 값만** 스레드가 나중에 다른 내 프로필을 가리키면(첫 불러오기 재시도 · 쪽 넘김) 그쪽으로 다시 정한다. 스레드(①)가 정한 값 · 사람이 고른 값은 건드리지 않는다. 이 스레드의 프로필과 다른 것으로 바꿀 때만 한 줄 확인(`Use ○○` / `Keep 지금 값`) — 떠 있는 동안 폼에 알려(`onUnsettledChange`) 제출을 막고, Esc · 폼 밖 포커스 · 잠금 · 값 변화로 닫히며, 누른 뒤 포커스는 선택기 단추로 돌아온다. 폼의 칸 오류 문장은 `aria-describedby` 로 이어진다. `AuthorPickerView.createOpensDialog` · `useProfileDialog({ api, title, … })`(선택기의 「프로필 만들기」가 여는 프로필 관리 대화상자 — 쓰던 글 유지, 닫을 때 포커스는 선택기 자리).
- **`AuthorProfileManager`**: 목록 · 추가 · 이름 바꾸기(한 번에 한 줄) · 삭제 확인. 저장 · 취소 · 삭제 뒤 포커스를 옮기고, 상한 문장은 추가 칸의 설명이다. 추가가 네트워크 오류(status 0)로 끝난 뒤 같은 이름을 다시 보내면 같은 `Idempotency-Key`. 429 는 이름 바꾸기만 `foldDuration`(초 · 분 · 시간 · 일, `labels.rateLimited` 가 `{ unit, value }` 를 받는다)로 시간을 말하고 추가는 시간을 약속하지 않는다.
- **기기 기억**: `createAuthorMemory(storage, accountId)`(키에만 계정 id, 만들 때 다른 계정의 키를 지운다) · `forgetAuthorMemory(storage)`(계정 id 없이 지우기 — 앱의 계정 변경 핸들러 한 곳에서 쿼리 캐시 비우기와 함께).
- **오류**: `isAuthorProfileFormError` 는 `AUTHOR_PROFILE.` 코드만 가린다(400 이름 칸 오류는 앱의 검증 실패 필터 몫 — sample 의 `errorToast.ts`). `refreshProfilesOnAuthorRefusal(client, error)` — 게시판이 작성자 id 를 거절하면(`BOARD.AUTHOR_NOT_ALLOWED`) 프로필 목록 캐시를 낡았다고 표시. 모르는 이름 칸 오류 코드는 일반 문구.

### Changed — `apps/sample`: 작성자 프로필 연결

- 설정 화면에 「글 · 댓글에 쓰는 프로필」 구역(`#profiles`, `AuthorProfileManager` — 이름 바꾸기 · 삭제는 게시판 캐시도 갱신). 계정 이름(닉네임)은 지우지 않았다 — 「나만 보는 이름」이라는 문구가 붙었고 안내 띠 · 대화상자의 문구도 같게 바뀌었다.
- 게시판: 글쓰기 · 댓글 · 답글에 선택기(`authorPicker`, 고치기에는 없음), 글 상세의 내 글 판정은 `isOwn`(서버의 `mine`), `<BoardComments key={post.id} postAuthor>`. 작성자 자리의 삭제 문구는 「삭제된 사용자」.
- **동작 변경**: 「닉네임이 없으면 쓰기 전에 닉네임 대화상자」(`NICKNAME_BEFORE_WRITE`)는 「서버가 작성자를 요구하는데 **이름 있는** 프로필이 하나도 없으면(백엔드가 자동으로 만든 이름 없는 첫 프로필뿐이어도) 쓰기 전에 프로필 만들기 대화상자」(`PROFILE_BEFORE_WRITE`)로 바뀌었다. 선택기가 이름 있는 프로필이 없을 때 「프로필 만들기」를 보이고 그 단추가 같은 대화상자를 연다(쓰던 글 유지) — 새 글 · 새 댓글 · 답글만 막히고 댓글 수정은 걸리지 않는다. `useNicknameGate().ensure` 는 없어졌다(`open` 만). 샘플은 `author-profile` 모듈이 필수다.
- **동작 변경**: 설정의 접힌 「문의용 정보」(계정 id + 복사)를 없앴다 — 계정 id 는 화면 · aria 어디에도 그리지 않는다.
- 전역 오류 토스트는 `AUTHOR_PROFILE.*` 오류를 건너뛰고(폼이 제자리에서 말한다) 게시판이 작성자를 거절하면(`BOARD.AUTHOR_NOT_ALLOWED`) `refreshProfilesOnAuthorRefusal` 로 프로필 목록을 다시 받게 하고(`app/queryClient.ts`), 계정이 바뀌거나 로그아웃하면 서버 상태 캐시와 함께 기기 기억(`forgetAuthorMemory`)을 한 곳(`onAccountChange`)에서 지운다.
- e2e `authorProfiles.e2e.ts`(백엔드 `author-profile` 이 켜진 샘플 필요) · 기존 e2e 의 글쓰기 단계는 프로필이 필요하면 하나 만들어 고른다.

### Changed — 닉네임 하나로 통일 · 눌리는 것은 눌려 보이게 · 닉네임 바꿀 때의 확인 문구(`@skeleton/author-profile` · `@skeleton/auth` · `apps/sample`)

주인이 견본 앱을 써 보고 — 「닉네임 여러 개 해놓고 선택해서 쓸 수 있게」 · 「눌리는 것들은 다 눌리겠구나 하게」.

- **화면에서 「프로필」이라는 낱말을 쓰지 않는다(코드 · 패키지 이름은 그대로)**. 사용자에게는 개념이 하나 — 「닉네임」. `@skeleton/author-profile` 의 기본 문구(영어)가 `profile` → `nickname`(`Choose a nickname` · `3 of 5 nicknames` · `New nickname` · `Add nickname` · 이름 바꾸기 → `Change`). sample 한국어: 구역 「내 닉네임」 · 「닉네임 {max}개 중 {n}개」 · 「새 닉네임」 · 「닉네임 추가」 · 「바꾸기」 · 꼬리표 설명 「같은 닉네임을 쓰는 다른 사람과 구분하려고 번호(#1234)가 붙을 수 있어요」.
- **sample 이 계정 닉네임(`displayName`)을 화면에서 숨긴다**: 설정 「계정」 구역의 닉네임 줄 · 설명, 안내 띠의 계정용 「닉네임 정하기」 · 계정 닉네임 대화상자(`NicknameDialog`) · `/account` 의 닉네임 칸 · 대시보드 인사말(이제 중립 인사)을 없앴다. 가입의 「닉네임」 칸은 그대로(서버가 그 값으로 첫 닉네임을 만든다), 도움말만 「첫 닉네임이 돼요. 나중에 더 만들거나 바꿀 수 있어요.」. `/account` 의 남은 절은 「언어 · 시간대」(`appAuthLabels` 가 `sectionProfile` · `profileSaved` 를 덮는다).
- **`@skeleton/auth` — `showDisplayName`**(`AccountSettings` · `ProfileSection` · `createAuthRoutes` 의 `settings`; 기본 `true` = 지금 동작 그대로): `false` 면 닉네임 줄(칸 · `닉네임#번호`)을 그리지 않고 저장 요청에도 싣지 않는다 — 언어 · 시간대만 남는다. 계정 닉네임 부품은 그대로 두고 starter 처럼 작성 닉네임을 쓰지 않는 앱의 계정 화면은 바뀌지 않는다.
- **안내 띠(`NicknameNudge`)는 한 가지**: 「이름 없는 닉네임만 있을 때」(링크 가입 등)에만 — 「닉네임을 정해 주세요」 / 「닉네임이 없으면 게시판에서 「이름 없는 사용자」로 보여요.」 / 주 단추 하나 「닉네임 정하기」(그 자리 대화상자) / 「나중에」. 글쓰기 전 확인(`PROFILE_BEFORE_WRITE`)도 **같은 대화상자**(`useNicknameDialog`). `useNicknameGate().open` 은 포커스 복귀를 위해 클릭 이벤트를 받는다.
- **눌리는 것은 눌려 보인다**: 설정의 「계정 관리 →」 는 줄 전체가 눌리는 링크 카드(`LinkCard` — 테두리 · 화살표 · hover/focus), 노트 · 글 제목 · 「모두 보기 →」 는 밑줄 글자 링크(`TextLink`). 작성자 선택기의 ▾ 는 본문 글자 크기 · 본문 글자색으로 키웠다(작은 회색 점이라 눌리는 단추로 안 보였다).
- **닉네임을 바꿀 때의 확인 문구**(`AuthorPickerNotice`): 「이 글에서는 에이#2232(으)로 쓴 적이 있어요 [그래도 비#0614(으)로] [에이#2232 유지] [댓글 등록]」 이 조사가 어색하고 단추 셋이 한 줄에 몰렸다 → 한 문장 「이 글에는 ‘에이#2232’ 닉네임으로 쓴 적이 있어요. 지금은 ‘비#0614’ 닉네임을 골랐어요.」 + 이름 없는 단추 둘 「이대로 쓰기」 · 「되돌리기」(좁은 화면에서는 줄이 바뀐다). **`AuthorProfileLabels` 변경**: `switchNotice(threadName, nextName)`(인자 하나 더) · `switchConfirm` · `switchKeep` 은 함수가 아니라 문자열. `withProfile` 은 쓸 곳이 없어 없앴다.
- **선택기 단추 ≠ 확인 문장 버그 수정**: 다른 닉네임을 고르면 확인 줄은 「지금은 ‘비’ 를 골랐어요」 인데 단추는 옛 닉네임을 보였다(확인 전 선택을 보류하는 설계). 이제 **선택을 곧바로 반영**하고(단추 = 올라갈 닉네임) 확인은 제출만 막는다. 「되돌리기」 · Esc · 폼 밖 포커스는 고르기 전 값으로, 「이대로 쓰기」 는 확인만 닫고 기기 기억에 쓴다. 확인 중에는 오류(빨강)가 아닌 주의색 한 덩어리. 폼의 작성자 자리(`AuthorSlot`)는 자기 줄을 통째로 쓰고 제출 단추는 그 아래 줄이다(확인이 떠도 위치가 튀지 않는다).
- e2e · 스토리 · 단위 테스트 · 카탈로그를 이에 맞췄다(`wording.test.ts` 가 한국어 · 영어 사전에 「프로필」/`profile` 이 없음을, `useAuthLabels.test.ts` 가 계정 화면 문구도 그러함을 지킨다).

### Changed — `apps/sample` 닉네임 안내 띠

- 닉네임 없는 계정의 안내 띠: 조건(계정 닉네임이 없음)은 그대로이고, 제목 · 주 버튼은 「닉네임을 정해 주세요」 · 「닉네임 정하기」(나만 보는 계정 이름), 보조 링크 「프로필 이름 정하기」가 설정의 프로필 구역으로 간다. 본문은 「첫 프로필이 만들어질 때의 닉네임이 한 번 복사된다」로만 말한다. 프로필 이름은 쓰기 시점의 프로필 게이트가 묻는다.

### Added — `@skeleton/ui`

- `RowMenu` 에 `describedBy`(버튼의 `aria-describedby` — 메뉴 칸 밖의 설명 · 폼 오류 문장의 id). 이름(`label`)은 그대로. 스토리 `DescribedByTiesAnOutsideDescriptionToTheButton`. 메뉴는 폭이 내용에 맞춰 넓어지고(`width: max-content`, 최소 12rem) 상한은 `min(24rem, 100vw − 여백)` — 상한을 넘는 항목만 상자 안에서 말줄임(전체 이름은 글자 그대로 낭독 이름), 항목의 `content` 로 보이는 모양을 직접 정할 수 있다(이름은 `label` 그대로). `Button` 의 `aria-disabled` 는 `:disabled` 처럼 흐리고 hover · active 효과가 없다.

### Changed — `@skeleton/board`: 작성자 선택기 자리 · `mine` 소유 판정 · `authorRequired` (작성자 프로필을 쓰는 서버)

다른 패키지를 모른 채, 작성자 id 가 계정 id 가 아닌 서버를 받을 수 있다. 옛 서버(필드 없음)는 그대로 동작한다.

- **타입**: 글 · 댓글 응답 `mine?`, `BoardConfig.authorRequired?`, 생성 입력 `authorId?`(고칠 때는 없다 — `PostPatch` 는 `Partial<Omit<PostInput, 'authorId'>>`). 응답의 `authorId` 는 프로필 id(`prf_…`) 또는 켜기 전 옛 행의 `pending:p<id>` · `pending:c<id>`.
- **소유 판정**: `isOwn(item, currentUserId)` = `mine ?? (authorId === currentUserId)` — `CommentItem` 이 쓴다(글 쪽도 같은 함수). `mine` 은 호출자마다 달라 계정이 바뀌면 앱이 쿼리 캐시를 비운다.
- **선택기 자리**: `PostEditor` · `CommentForm`(답글) · `BoardComments` 의 `authorPicker` 렌더 prop(`AuthorPicker` · `AuthorPickerArgs` = `{ value, onChange, threadAuthorId, threadLoading, invalid, disabled, onUnsettledChange, 'aria-describedby' }`). **`authorRequired === true` 일 때만 그려지고 `authorId` 를 싣는다**(서버는 필수가 아닐 때 보낸 `authorId` 를 403 으로 거절한다). 고치기 폼에는 주지 않는다. 값이 없으면 칸 오류로 막고 선택기로 포커스, 선택기가 답이 필요한 질문을 띄웠다고 알리면(`onUnsettledChange`) 그동안도 제출을 막고 포커스를 질문(`data-author-notice`)으로 보낸다 — 오류 문장은 `aria-describedby` 로 선택기에 이어진다. 필수인데 선택기를 꽂지 않았으면 막지 않는다(고를 수단이 없는 막다른 길이 되므로 서버가 400 `BOARD.AUTHOR_REQUIRED` 로 답한다).
- **스레드 단서**: `lastOwnAuthorId(comments)` — 현재 쪽의 `mine` 댓글 중 마지막 `authorId`(탈퇴 · `pending:` 건너뜀, 시각은 `Date.parse`). `BoardComments` 의 `postAuthor` 로 글 작성자를 대체 단서로 더한다. 현재 쪽의 댓글이 오는 중이거나 이전 쪽이 placeholder 인 동안은 `threadLoading`(첫 불러오기 **실패**는 아니다 — 선택기는 잠기지 않고 목록의 「다시 시도」가 있다).
- **폼의 작성자 오류**: 「안 골랐다」 · 「질문에 먼저 답해 달라」는 **사실**만 보관하고 문장은 그릴 때 지금의 `labels.authorRequired` · `labels.authorUnsettled` 에서 읽는다(문구가 바뀌어도 낡은 문장이 남지 않는다).
- **이식할 때 주의**: 새 라벨 키 `authorRequired` · `authorUnsettled`(`CommentLabels` · `PostEditorLabels` — 번역을 쓰는 앱은 키를 더한다, 없으면 영어 기본값) · `CommentForm.onSubmit` 이 `(body, authorId?)` · `onReply` 가 `(parentId, body, authorId?)`(옛 호출부는 그대로) · `PostEditorValues` 에 선택 `authorId` · 가짜 서버 `createFakeBoard({ authorRequired, owned })`(`mine` 을 싣고, 필수가 아닐 때 `authorId` 를 보내면 403).
- `@skeleton/api-client`: `ErrorCodes.BOARD_AUTHOR_REQUIRED`(400) · `BOARD_AUTHOR_NOT_ALLOWED`(403).

### Fixed — 독립 코드 리뷰 반영 (2026-10-07)

- **`/account-deleted`**: 열린 라우트라 아무 길로나 열려도 로그아웃되던 것 — 탈퇴 흐름이 넘긴 `state.purgeAfter` 가 있을 때만 안내하고 로그아웃한다. 아니면 로그인한 사람은 홈으로, 아닌 사람은 로그인으로(`accountDeletedDestination`).
- **일회용 토큰 한 번만 보내기**(`runOnce` → `createOnceRunner`): 모듈 전역 Map 을 없애고 `createAuthRoutes` 한 벌(`ctx.once`)이 쥔다. 진행 중에는 겹친 호출이 같은 약속을 나누고, 끝난 뒤 **성공은 완료 표시만**(토큰 응답 · 오류 안의 `restoreToken` 을 쥐지 않는다) 1분, **실패는 바로 잊는다**(일시 네트워크 실패는 다시 보낼 수 있다). 키는 종류 접두사(`magic-link:` · `link-reauth:`). `TokenLanding` · `MagicLinkLanding` 에 `once` prop.
- **반응 낙관적 갱신**: 같은 대상의 더 나중 누름이 진행 중이면 앞선 응답이 덮지 않는다(마지막 답이 덮는다). 글 반응이 끝나면 **목록 키만** 서버와 다시 맞춘다(상세는 조회수가 올라 제외). e2e 의 15초 대기를 걷었다 — PUT 응답을 기다린 뒤 이동한다.
- **`FormProblems`**: 요약 목록은 낭독 영역이 아니다(`role="group"`). 나타나는 순간 **한 번만** 낭독하고(고정된 `role="alert"` 하나) 이후 타이핑으로 목록이 줄어도 다시 읽지 않는다. 스토리가 낭독 영역의 변경 횟수 0 을 단정.
- **프로필 저장 콜백**: `AccountSettings` · `createAuthRoutes({ settings: { onProfileChanged } })`. 샘플은 내 프로필 쿼리와 게시판 키를 다시 읽는다(`refreshAfterProfileChange`) — 닉네임 대화상자도 같다. 스타터는 기본 그대로.
- **인증번호 다시 받기**: 만료 뒤의 다시 받기가 무시돼 지나간 `expiresAt` 이 오면 「새 번호를 보냈어요」 대신 처음부터 다시. 진행 중 두 번 눌러도 요청은 하나. 첫 가입 응답의 `resendExhausted` 를 버리지 않는다. `CodeEntry` 에 `restart`(더 다시 보낼 수 없는 번호가 만료되면 「처음부터 다시」로 포커스) · 만료 문구 `codeTimeUpNoResend`. 만료 판정 뒤에도 느리게 지켜봐(2초) 서버 시계 표본이 늦게 와도 잘못된 만료가 굳지 않는다.
- **작성자 꼬리표**: 겹침을 `nameKey`(NFKC · 소문자 · 보이지 않는 문자 제거)로 접어 비교(서버가 같은 이름으로 접는 `Sumin`/`sumin`). `BoardComments` 가 한 쪽의 모든 줄기를 한 범위로 계산해 `AuthorScope` 로 감싸지 않아도 줄기 사이 겹침이 잡힌다(`scopeNames`). 이름은 `<bdi>`, 작성자 열은 최대 폭 + 말줄임, 댓글 단추 이름(`답글: 수민#4821`)에 보이는 꼬리표 포함.
- **`Button.disabledReason` 삭제**(호출부 없음 · 꺼진 버튼은 키보드 · 터치로 이유에 닿지 못한다) — 원칙은 「꺼 두지 않고 누르면 이유를 말한다(`FormProblems`)」.
- **모듈 기본값 중립(깨지는 변경)**: `confirmPassword`(가입 · 재설정 · 변경) 기본 true → **false**, `ConsentBanner.reserveSpace` 기본 true → **false**. 샘플 · 스타터 · SSR 스타터가 명시적으로 켠다(앱 동작 그대로). 이번 묶음에서 새로 생긴 prop 중 기본값이 동작을 바꾸는 것은 이 둘뿐이다(`displayName` 은 처음부터 `off`).
- 작은 것들: 닉네임 입력의 `maxLength={60}`(UTF-16)을 뺐다(이모지가 잘렸다 — 검증은 코드 포인트) · `formatIp` 문구 「이 기기(로컬)」 → 「로컬 주소」 · 샘플의 닉네임 대화상자만 조용히(`meta.quietStatuses`, 전역 토스트의 `ACCOUNT.RATE_LIMITED` 일괄 제외 삭제) · `displayNameRateLimited` 는 코드로만 판정 · `DeletionPendingScreen` 으로 바뀔 때 제목으로 포커스 · `signUpPending` 허용 필드만 저장 · 만료 항목은 읽을 때 삭제 · `deleteAccount` 의 멱등 키 전달 · 가입 코드 단계 닉네임 재시도가 await 뒤 낡은 입력으로 덮지 않는다.

### Changed — 백엔드 FINAL-5 리뷰 계약(R1–R9) 반영 (2026-10-07)

- **R1 가입 인증번호 단계의 닉네임 겹침**: `verifySignUpCode(signUpId, code, { displayName? })`. `409 ACCOUNT.DISPLAY_NAME_TAKEN` 이어도 시도가 닫히지 않으므로 **양식으로 돌려보내지 않고** 그 자리에서 닉네임만 다시 입력받아(`NicknameRetry` — 「이미 쓰고 있는 닉네임이에요」) 같은 `signUpId` · 같은 인증번호로 다시 확인한다. 비밀번호 재입력 없음, 인증번호 남은 시간은 계속 흐른다. (이전 동작 「양식으로 돌아가 처음부터」는 없어졌다 — 라벨 `displayNameTakenRestart` 삭제, `nicknameRetryHint` · `nicknameRetryAction` 추가.)
- **R2 `resendAvailableAt: null`**: `CodeWindow.resendExhausted` · `PendingSignUp.resendExhausted`. 이 시도는 더 다시 보낼 수 없으니 「다시 받기」를 숨기고 안내(가입 「만료되면 처음부터 다시 가입해 주세요」), 시간이 다 되면 「처음부터 다시」 버튼 — 가입 · 이메일 변경 · 다시 인증 · 삭제 확인 모두(`VerifyCodePanel` · `ReauthProof`). 응답 타입 `resendAvailableAt?: string | null`.
- **R3 닉네임 변경 한도**: `429 ACCOUNT.RATE_LIMITED`(`retryAfterSeconds`) → 프로필 칸 아래 「닉네임을 너무 자주 바꿨어요. 3시간 12분 뒤에 다시 해 주세요.」(`displayNameRateLimited` · `formatWait` export, 전역 토스트는 샘플이 뺀다). 샘플 닉네임 대화상자도 같다.
- **R4 닉네임 필드 오류**: 서버 `Required` · `Size` · `Pattern` · `Reserved` 를 우리 문구로(`displayNameFieldError` — 서버의 영어 message 는 보이지 않는다). 사전 검증: `#` · `@` 는 같은 문구로 바로 안내하고, 길이는 **코드 포인트**로 센다(👩‍💻 같은 조합 이모지는 막지 않는다). 「1~60자로 입력해 주세요」.
- **R5 「이미 계정이 있어요」 메일의 링크**: `/login` · `/forgot-password` 는 샘플 · 스타터 · SSR 스타터에 있고 로그아웃 상태에서 열린다(스타터 라우트 테스트에 추가). 로그인된 채 `/login` 은 가려던 곳(대시보드)으로 이동한다.
- **R6 댓글 알림 payload**: 프런트(`@skeleton/notifications` · 샘플)는 payload 의 `authorName` 을 읽지 않는다 — 변경 없음. 계정 id 는 화면에 그리지 않는다.
- **R7 IPv6 압축 표기**: `formatIp` 가 `::1` 도 「이 기기(로컬)」로 처리하는지 테스트 추가.
- **R9 관리자 오류**: `ErrorCodes.ACCOUNT_ERASURE_IN_PROGRESS` · `ACCOUNT_ERASURE_RETRY` 와 문구(`errorErased` · `errorErasureInProgress` · `errorErasureRetry` · `errorNotSuspended`).
- 가짜: `createFakeAccountApi({ nicknameChangeLimit, reservedNicknames, resendExhausted })`, `fieldError`. 스토리: `NicknameTakenAtTheCodeStepAsksForAnotherInPlace` · `CodeStepWithNoMoreResends…` · `NicknameChangeLimitNamesTheWait` · `NicknameReservedByTheServerUsesOurSentence` · `NicknameSymbolsAreRefusedAtOnceEmojiAreFine` · `EmailChangeCodeWithNoMoreResends` · `DeleteCodeWithNoMoreResends`.

### Fixed — 실제 백엔드 QA: 링크 이중 redeem · 탈퇴 직후 화면 · 기기 목록 IP (2026-10-07)

- **링크 로그인이 두 번 redeem 되던 것**: 원인은 ref 가 아니라 **화면이 새 인스턴스로 다시 마운트**되는 것이었다(StrictMode 는 ref 가 이어져 막힌다 — 실측: 첫 인스턴스가 정리된 뒤 새 인스턴스가 `started=false` 로 효과를 돌렸다. 로그인되는 순간 위쪽이 화면을 다시 그린다). 같은 토큰의 호출을 모듈 수준에서 한 번만 보내고 결과(성공 · 실패)를 나눠 쓴다(`runOnce`, 1분 보관). `TokenLanding`(링크 로그인 · 확인이 필요한 링크의 「계속」)과 소셜 연결의 「두 인가 코드로 연결」에 적용. 소셜 로그인 콜백은 `flow.complete` 가 이미 state 별로 한 번(모듈이 아니라 flow 인스턴스 기준). 비밀번호 재설정 · 탈퇴 취소 · 인증번호는 사람이 누르는 호출이라 자동 제출이 아니다. 같은 링크를 일부러 새로고침해 다시 열면 서버가 410 으로 답하는 것은 정상(일회용).
- **탈퇴 직후 화면**: 삭제가 받아들여지면 `/account` 에 남지 않고 로그아웃 상태의 안내 `AccountDeletedScreen`(`/account-deleted`, 보호되지 않은 라우트)으로 간다 — 「탈퇴가 접수됐어요. {날짜}에 지워져요.」 + (`settings.selfRestore` 면) 「그 전에 다시 로그인하면 취소할 수 있어요.」 + 「로그인 화면으로」. 이 화면이 로컬 세션을 지운다(머리글도 로그아웃 상태). 샘플은 `settings.selfRestore: true`. `AuthPaths.accountDeleted`(기본 `/account-deleted`) 추가 — `paths` 를 통째로 만드는 앱은 한 줄을 더한다.
- **기기 목록 IP**: `formatIp` — 루프백(`127.x` · `::1` · `0:0:0:0:0:0:0:1` · `::ffff:127.0.0.1`)은 「이 기기(로컬)」(`labels.sessionsLocalDevice`), 그 밖의 IPv6 는 압축 표기.
- 샘플 `useMyProfile` 은 토큰이 없으면 요청하지 않는다(로그아웃 순간 캐시가 비워지며 다시 읽으려다 401 토스트가 뜨던 것). 낡은 주석(「오늘 백엔드는 만료 시각을 안 준다」 · 「동의 모듈은 아직 없다」) 정리.

### Changed — 눌리는 것은 한눈에 눌리는 것으로 보인다 (2026-10-07)

주인 피드백 — 「계정 설정의 닉네임 정하기 같은 버튼도 고치라는 건데. 눌리는 것들은 다 눌리겠구나 하게 디자인하라고」. 글자만 있던 버튼(`ghost`)이 원인이었다.

- **`@skeleton/ui` `Button`**: `ghost` 에 쉬는 상태의 테두리(`--border-strong`) + hover 바탕. 새 변형 `link`(밑줄 + 링크색, 상자 없음 — 글 사이 링크용). 높이 md 44px · sm 36px(거친 포인터 44px) · lg 52px. `:active`(눌림) · 더 또렷한 `:focus-visible` · 흐린 비활성 + `not-allowed`(막힌 이유는 비활성 대신 누르면 말한다 — `FormProblems`; 호출부 없던 `disabledReason` 은 이 묶음에서 뺐다). 위험은 위험색 테두리 + hover.
- 같은 원칙으로: `SectionCard` 펼침 머리(테두리 상자 + 화살표) · `AppShell` 내비(44px · hover 바탕 + 밑줄) · `PageHeader` 뒤로 링크(밑줄) · `RowMenu` ⋯(테두리 상자 · 이전에는 투명) · 알림 종 · 테마 토글 · 복사 · 목차 알약 · 대화상자 닫기 · 쪽 이동 · 탭이 44px, 샘플 `LinkButton`(ghost 테두리).
- **동작 변경(모양)**: 취소 · 보기 · 답글/수정/삭제 · 로그아웃 · 쿠키 설정 같은 `ghost` 버튼이 테두리 상자로 보인다. 버튼이 커져(38 → 44px) 줄 높이가 늘 수 있다. 입력칸 · 셀렉트(38px)는 그대로.
- **좁은 폭 머리글**: 버튼이 44px 로 커지며 로고가 종 버튼에 가려지던 것을 `AppShell` 에서 고쳤다 — 좁은 컨테이너에서 로고는 줄어들지 않고(`flex: 0 0 auto`), 행동들은 옆에 안 들어가면 다음 줄로 감긴다(320 · 360 · 390px 스토리 `SignedInHeaderAt…` 가 가로 스크롤 · 잘림 · 겹침 없음을 단정). 내비는 기본 글자색을 진하게, 지금 위치는 굵게 + 아래 막대 + 바탕, 눌림 바탕을 더했다.
- 가드: `packages/ui/src/Button/affordance.test.ts`(모든 변형의 쉬는 상태 테두리/채움 · 높이 · 상태 · 아이콘 버튼 표) · `apps/sample/src/components/LinkButton.affordance.test.ts` · 스토리 `EveryVariantLooksPressableAtRest` · `DisabledExplainsWhy`. 새 대비 짝(`--text-strong` on `--teal-wash` · `--teal-soft`, 눌린 주 버튼)을 `tests/contrast.test.ts` 에 등록. 원칙은 `docs/ui-catalog.md` 맨 위.

### Added — 닉네임: 게시판 작성자 표시 · 가입 닉네임 칸 · 꼬리표 (2026-10-07)

주인이 견본 앱을 써 보고 — 「게시판에 작성자가 없어서 뭐가 뭔지 모르겠다」 · 「계정 ID `acc_317e…` 가 박혀서 보기 싫다」. 백엔드 계약 가정: 글 요약 · 상세 · 댓글 응답에 `authorName`(닉네임 · null) · `authorTag`(4자리 문자열 · null) 추가(`authorId` · `authorDeleted` 유지), `GET /account/me` 에 `displayTag`, 닉네임 중복 금지 서버의 `409 ACCOUNT.DISPLAY_NAME_TAKEN`. 필드가 없는 옛 서버에서도 깨지지 않는다(모두 「이름 없는 사용자」).

- **`@skeleton/board`**: `PostSummary` · `Comment` 에 `authorName?` · `authorDeleted?` · `authorTag?`. 작성자 표시 규칙 한 곳 — `resolveAuthor` · `<AuthorName>`(아바타 + 이름, 아바타는 스크린 리더에서 숨겨 이름이 한 번만 읽힌다): 탈퇴(`authorDeleted` 또는 id 가 `deleted:`) → 「탈퇴한 사용자」/"Deleted user", 닉네임 → 그 이름, 없음 → 「이름 없는 사용자」/"Unnamed user". `PostList` 작성자 열(`labels.author`), `PostDetail` 의 제목 아래 줄, 댓글 · 대댓글. 꼬리표 `#4821` 은 `authorTag` prop(`'collision'` 기본 = 같은 목록 · 스레드에서 서로 다른 계정이 같은 닉네임일 때만 · `'always'` · `'never'`)이 정하고 흐린 글씨. `collidingNames` · `showsTag` 순수 함수. **`AuthorScope`**: 글 상세에서 `PostDetail` · `BoardComments`(`CommentThread`)를 감싸면 글쓴이와 그 글의 모든 댓글 작성자를 한 범위로 묶어 겹침을 판정한다(감싸지 않으면 영역마다 따로 — 기본 그대로). 샘플 글 상세가 감싼다. **동작 변경**: 댓글 작성자 자리 · 단추 `aria-label`(「답글: …」)에 계정 id 가 아니라 표시 이름이 들어간다(기본 `renderAuthor` 없음 → `<AuthorName>`). `renderAuthor` 는 `(authorId, { kind, name, tag, deleted })` 로 두 번째 인자가 늘었을 뿐 첫 인자만 쓰는 옛 호출부는 그대로 동작. `PostList` 표에 열이 하나 늘었다(셀 순서 작성자 → 댓글 …). 라벨 `authorDeleted` · `authorUnnamed`(글 목록 · 상세 · 댓글 공통) · `PostList.labels.author`. `BoardComments` 의 `beforeWrite?: () => boolean`(새 댓글 · 답글 · 수정을 보내기 직전에 false 면 막고 쓴 글은 남는다 — 앱이 먼저 할 일이 있을 때). 가짜 `createFakeBoard({ nicknames, tags })`(`deleted:` 로 시작하는 id = 탈퇴).
- **`@skeleton/auth`**: 가입 · 프로필의 이름 칸을 「표시 이름」/"Display name" 에서 **「닉네임」/"Nickname"** 으로(`labels.displayName`). `SignUpScreen` 에 `displayName: 'off' | 'optional' | 'required'`(기본 `off` — 스켈레톤은 기본을 안 바꾼다 · 옛 `askDisplayName` 호환), 앞뒤 공백 제거 1..60자, 필수인데 비우면 `FormProblems`. `ACCOUNT.DISPLAY_NAME_TAKEN` → 「이미 쓰고 있는 닉네임이에요」(가입 제출 · 프로필은 칸 아래, 인증번호 단계는 시도가 닫히지 않으니 그 자리에서 닉네임만 다시 입력 — 아래 R1). `AccountMe.displayTag?` — 프로필 절이 `닉네임#번호` 와 복사 버튼을 보인다. `ErrorCodes.ACCOUNT_DISPLAY_NAME_TAKEN`(`@skeleton/api-client`). 가짜 `createFakeAccountApi({ displayTag, takenNicknames })`.
- **`apps/sample`**: 가입에서 닉네임 필수 · 설정의 「계정 ID」 줄을 닉네임(`#번호`) · 이메일 중심으로 바꾸고 계정 id 는 접힌 「문의용 정보」(복사 버튼) 안으로 · 대시보드 인사말은 닉네임, 없으면 중립 인사(이메일 · id 를 쓰지 않는다) · 닉네임 없는 로그인 사용자에게 화면 위쪽의 눈에 띄는 띠(강조색 바탕 · 굵은 제목 · 채워진 주 버튼 「닉네임 정하기」 — 색만으로 강조하지 않고 본문 대비 4.5:1 을 `tests/contrast.test.ts` 가 지킨다) → 설정으로 보내지 않고 그 자리의 `Dialog`(닉네임 입력 · 저장 · 겹침 안내)로, 띠는 닫을 수 있지만 저장하지 않아 다음 방문에 다시 보인다(`NICKNAME_NUDGE` 로 끈다) · 닉네임이 없으면 게시판에서 글 · 댓글을 쓰려 할 때 같은 대화상자가 먼저 뜬다(`NICKNAME_BEFORE_WRITE` 로 끈다 — 쓰던 글은 남는다) · `useMyProfile`(`GET /account/me` 쿼리) · 게시판 한국어 · 영어 문구. e2e 의 가입 양식은 닉네임 칸을 채운다(실서버 e2e 로 확인). `starter` · `starter-ssr` · `workbench` 는 기본 off 라 동작 변화 없음.

### Added — 탈퇴 유예 중 로그인 「탈퇴를 취소할까요?」 · 정지 · 가입 차단 안내 · 코드 요청 응답의 시각 (2026-10-07)

백엔드(kotlin-skeleton `docs/account-http-contract.md` §8 · §9)의 탈퇴 수명주기 변경에 맞춘다.

- **`@skeleton/auth`**: 탈퇴 유예 중 계정이 로그인(비밀번호 · 링크 · 소셜)하면 `403 AUTH.ACCOUNT_DELETION_PENDING` → `DeletionPendingScreen`(「탈퇴를 취소할까요?」 · 취소하고 계속 쓰기 · 그대로 두기). 취소 = `authApi.cancelDeletion` / `auth.cancelDeletion`(`POST /account/delete/cancel` → 일반 로그인 응답, 세션 저장 · 가려던 곳 이동). 410 → 「시간이 지났어요」. `restoreToken` 은 메모리에만. 토큰이 없으면(서버 self-restore 꺼짐) 안내만. `deletionPendingOf(error)` · `AuthApi.cancelDeletion` 은 **필수 멤버**라 `AuthApi` 를 직접 구현한 앱은 한 줄을 더해야 한다. `ACCOUNT.SUSPENDED_CANNOT_DELETE`(「정지된 계정은 탈퇴할 수 없어요」) · `ACCOUNT.REGISTRATION_BLOCKED`(「이 주소(계정)로는 가입할 수 없어요」) 문구. 삭제 안내의 「직접 되돌릴 수 없어요」를 뺐고(self-restore 와 모순) `selfRestore` 를 알린 앱에만 「다시 로그인하면 취소」를 더한다.
- **`@skeleton/api-client`**: `ErrorCodes` 에 `AUTH_ACCOUNT_DELETION_PENDING` · `ACCOUNT_ERASED` · `ACCOUNT_SUSPENDED_CANNOT_DELETE` · `ACCOUNT_NOT_SUSPENDED` · `ACCOUNT_REGISTRATION_BLOCKED`. (관리자 화면의 `ERASED` · erase · 차단 목록은 이번에 안 했다.)
- **카운트다운**: `email/change` · `reauth/confirmation` · `delete/confirmation` 응답의 `expiresAt` · `resendAvailableAt` 을 쓴다(`createAccountApi` 가 응답을 돌려준다 · 없으면 어림). 어림 기본 TTL 1800 → **600 초**(백엔드 기본 10분 통일 — 안내 문구의 「30분」도 10분으로). 만료된 가입 시도의 「다시 받기」는 먼저 서버에 다시 받기를 하고 응답에 새 `expiresAt` 이 있으면 그 자리에서 타이머를 다시 시작(보관 상태도 갱신), 없으면(옛 서버) 처음부터 다시.
- 가짜(스토리): `createFakeAuthApi({ pendingDeletion, cancelExpired })` · `createFakeAccountApi({ suspended, registrationBlocked, codeWindowMinutes })`, 스토리 `Patterns/Auth/Deletion pending`.

### Added — 인증번호 남은 시간 카운트다운 (2026-10-07)

주인 요청 — 「10분 제한 뒀는데 카운트도 넣어줘 보통 다 있던데」.

- **`@skeleton/ui` `CodeEntry`**: `expiresAt`(절대 시각 — ISO · `Date` · ms) · `now`(시계) · `timeLabels` · `expirySource`(`server`/`estimate` → `data-expiry-source`) · `onExpire`. 칸 옆에 `mm:ss`(문구는 prop). **매 틱 `now()` 를 다시 읽는다**(감산 아님 — 탭이 잠들었다 깨도 맞고, 서버 보정 시계를 넘기면 기기 시계 오차가 없다). 60초 아래는 빨강 + 굵게 + 밑줄(색만이 아니다), 읽어 주는 영역은 60초 · 10초 · 끝에서만 바뀐다(초마다 낭독하지 않는다). 끝나면 칸 잠금 + 안내 + 「다시 받기」 포커스. 새 `expiresAt` 이 오면(다시 받기) 칸을 비우고 처음부터 센다. 서버 렌더에는 시간을 그리지 않는다(하이드레이션 일치). 움직임 없음. 다시 받기 쿨다운은 버튼 글자에 초로(`resend.labelWhileWaiting`) — 초마다 낭독되던 `aria-live` 는 없앴다. 순수 계산: `secondsRemaining` · `formatClock` · `stageOf` · `expiryMillis`.
- **`@skeleton/auth`**: 가입 · 이메일 변경 · 다시 인증(메일 코드) · 삭제 확인의 모든 코드 단계에 적용. 만료의 출처: 이메일 변경은 서버 값(`me.pendingEmailExpiresAt`), 서버가 응답에 시각을 주면(최신 백엔드) 그 값이 이기고, 안 주는 옛 서버는 **문서화된 유효 시간으로 어림**(전부 600 초, `codeTtlSeconds` 로 바꾼다). 응답에 `expiresAt` · `resendAvailableAt`(ISO)이 오면 코드를 안 고쳐도 서버 값이 이긴다(`codeWindowOf`). 시계는 `createAuthRoutes({ now: () => serverClock.now().getTime() })`(샘플 · 스타터 · SSR 스타터 배선, 응답 `Date` 헤더 — 교차 출처면 `Access-Control-Expose-Headers: Date` 필요). 가입의 보관 상태는 만료 · 재요청 **시각**을 함께 보관한다(코드는 보관하지 않는다) — 새로고침해도 남은 시간 · 쿨다운이 이어진다. 가입은 만료된 시도의 다시 받기를 서버가 조용히 무시하므로 시간이 다 되면 「다시 받기」가 처음부터 다시로 이어진다(`expiredResend="restart"`). 라벨 `codeTimeLeft` · `codeTimeMinute` · `codeTimeTen` · `codeTimeUp` · `codeResendWaiting`(ko · en). **동작 변경**: 가입 직후 30초는 「다시 받기」가 잠겨 있다(서버도 무시하는 구간).

### Added — 가입 폼 사용성: 비밀번호 확인 · 놓칠 수 없는 제출 피드백 · 쿠키 배너가 폼을 가리지 않는다 (2026-10-07)

주인이 실제로 써 보다 겪은 문제 — 「이메일로 가입하기 눌렀는데 먹통」(필수 약관을 안 켠 채 눌러도 요청이 안 나가고 체크박스 옆 작은 글자뿐 · 아래 쿠키 배너가 그것을 가렸다) · 「비번 일치하는지 보는 거 넣어야지」.

- **비밀번호 확인 칸**(`confirmPassword`, 모듈 기본 **꺼짐** — 모듈은 중립이라 앱이 켠다; 샘플 · 스타터 · SSR 스타터는 `createAuthRoutes({ confirmPassword: true })` 로 켠다): 가입 · 재설정 · 변경 · 첫 설정. 건드린 뒤부터 일치 여부 실시간 안내 · 다르면 제출 막힘 · 「보기」가 두 칸 함께 · `new-password` 둘 · 붙여넣기 허용 · 성공하면 함께 비움 · **확인 값은 API 로 안 간다**. 끄기: 화면 prop · `AccountSettings` · `createAuthRoutes({ confirmPassword })`. 라벨 ko · en. 앱이 켠 화면의 e2e · 스토리는 확인 칸도 채워야 한다(샘플 e2e · 스토리 갱신).
- **`@skeleton/ui` — `FormProblems` · `useSubmitAttempt` · `revealControl`**: 제출 버튼 바로 위 `role="alert"` 오류 요약(줄 = 그 칸으로 데려가는 버튼) + 첫 틀린 칸으로 포커스 · 스크롤(움직임 줄이기 존중) + 틀린 칸 오류 테두리(`Checkbox` `aria-invalid` 윤곽). `Field` 가 `id` 를 받는다. 제출 버튼은 꺼 두지 않는다 — 막힌 이유를 말해야 하니까.
- **적용한 폼**: 가입(이메일 · 비밀번호 · 규칙 · 확인 · 필수 약관 · 서버가 거절한 규칙) · 로그인 · 비밀번호 찾기 · 재설정 · 비밀번호 변경 · 이메일 변경 · 소셜 연결 본인 확인 · 계정 삭제(`disabled` 버튼이던 곳 — 이제 눌리고 「먼저 본인 확인을 해 주세요」) · 재동의 화면. 고치면 그 줄이 곧바로 사라진다(체크하면 약관 오류가 즉시 풀린다).
- **`@skeleton/marketing` `ConsentBanner`**: `reserveSpace`(모듈 기본 **꺼짐** — 앱이 켠다, 샘플이 켠다) — 배너가 떠 있는 동안 `body` 아래 여백 + `html` `scroll-padding-bottom` 을 배너 높이만큼 잡아(크기가 바뀌면 따라가고 사라지면 되돌린다) 맨 끝까지 스크롤하면 폼 · 오류 · 제출 버튼이 배너 위에 오고 포커스 · `scrollIntoView` 도 배너 밑으로 숨지 않는다. 모든 페이지에 통한다(페이지별 예외 없음). 끄면(기본) 예전처럼 겹친다.
- **동의 체크리스트**: 필수 줄은 굵게 · 못 채우면 줄 테두리 + `aria-invalid` · 「전체 동의」 아래 설명(`agreeAllHint`) · 「보기」는 같은 화면 위의 창이라 친 입력이 남는다(스토리로 확인).

### Added — 글로벌 소셜 로그인(Google · LINE · X, PKCE S256 · nonce)과 법적 문서 · 동의(`@skeleton/legal`) (2026-10-07)

- **소셜 로그인은 발견이 이끈다**: `GET /auth/methods` 의 제공자마다 `pkce`/`nonce`(REQUIRED · SUPPORTED · UNSUPPORTED) · `authorize {url, scopes, params}` 를 읽어 authorize 주소를 만든다 — 프런트에 제공자 주소가 없다(`SOCIAL_AUTHORIZE_PRESETS` 는 authorize 정보를 안 보내는 옛 백엔드용 **LEGACY** 대체 표 — kakao · naver). 순서는 백엔드가 준 순서. **깨지는 변경**: `createSocialLoginFlow(...).start` / `createSocialLinkFlow(...).start` 가 `Promise` 를 돌려준다(WebCrypto SHA-256) · `session.socialLogin` / `authApi.socialLogin` 의 네 번째 인자 `{ codeVerifier, nonce }`.
- **PKCE · nonce**: 시도마다 `state` · `codeVerifier`(CSPRNG 43자) · `nonce` 를 탭 `sessionStorage` 에 제공자 · 종류(login · link · reauth) · 계정에 묶어 두고 한 번 쓰고 지운다. `codeVerifier`/`nonce` 는 로그인 · 연결(최상위) · `socialReauth`(이메일 변경 · 연결 해제 · 삭제)에 실린다 — 연결 도중 다른 제공자로 다시 인증하는 왕복은 두 시도의 verifier 를 각자 보낸다. PKCE 필수 제공자는 WebCrypto 없이는 시작하지 않고(`PkceUnavailableError` · 문구) `pkce: UNSUPPORTED` 에는 PKCE 파라미터를 보내지 않는다. 새 오류 문구: `AUTH.SOCIAL_PKCE_FAILED` · `NONCE_FAILED` · `ID_TOKEN_INVALID` · `INVALID_AUTHORIZATION_CODE` · `PROVIDER_GATEWAY_ERROR`.
- **콜백이 진짜 제공자에 견딘다**: 취소(`access_denied`)는 실패가 아니라 「취소했어요」 · state 없이 오는 `error` · 다른 탭이 시작한 콜백(탭 규칙 안내) · 로그인 뒤 쿼리 없는 콜백으로 돌아오면(뒤로 가기) 가던 길로 · redirectUri 의 출처 · 끝 슬래시 · 경로 불일치를 개발 콘솔에 경고(`redirectUriProblems`). README 에 「실제 제공자 붙일 때」 — 로그인 · 연결/재인증 콜백 주소 표.
- **제공자 표시**: `providerPresentation` — google · line · x · kakao · naver 인라인 SVG 마크(모르는 코드는 중립) · 문구 `providerSignInText`(ko: 「Google로 / LINE으로 / X로 계속하기」). ko `providerNames.google` 은 「구글」 → 「Google」.
- **주소 없는 계정**(LINE · X): 이메일 절이 빈 값 대신 「주소 없음」, 「이메일 추가」는 제공자 동의를 다시 거친다.
- **`@skeleton/legal`**(백엔드 `legal` · `legal-jdbc` 짝): `createLegalApi` · 훅 · `ConsentChecklist`(필수/선택 · 전체 동의) · `SignUpConsents`(가입 폼 슬롯 `SignUpScreen.renderConsents` — 보낸 `consents` 는 `{type, version, locale}`) · `createReconsentController` + `ReconsentGate`(403 `LEGAL.RECONSENT_REQUIRED` 를 api-client 의 새 `recoverForbidden` 으로 받아 동의 뒤 막힌 호출을 다시 보낸다 · 로그인 직후 `blocked` 확인 · 제외 경로 `/legal` `/auth` `/account`) · `ConsentSettings`(상태 · 이력 · 선택 동의 철회) · `ApiLegalDocumentPage`(서버 마크다운 · 판 · 효력일). 스타터 · SSR 스타터 · 샘플이 배선한다(백엔드 스타터가 legal 을 켜므로 모든 찍힌 프로젝트에 포함). 서버에 legal 모듈이 없으면(404) 아무것도 그리지 않고 가입을 막지 않는다.
- `@skeleton/api-client`: `recoverForbidden`(403 을 한 번 풀어 보는 훅 — `recoverUnauthorized` 의 짝) · `LEGAL.*` 오류 코드. `AccountPage` 의 `settings.after`.
- **고침**: 느린 러너에서 지던 스토리 경주 둘 — `SectionIndex` 는 방금 누른 절을 관찰자 보고가 되돌리지 않는다 · 다이얼로그 스토리는 부모가 닫힘을 반영(포커스 복귀)한 뒤 다시 누른다.

### Changed — 계정 프런트를 백엔드 FINAL-3(인증번호 · kotlin-skeleton cbb8b4a)에 맞춘다 — 링크 왕복을 걷어낸다 (2026-10-07)

- **초안 대비 어긋남을 바로잡음**: `ACCOUNT.CODE_INVALID`/`CODE_EXPIRED`/`AUTH.TOO_MANY_REFRESHES` 코드 · `verifySignUpCode`(`createAccountApi(client, { deviceName })`) · `magicLinkRedeem`(세션의 `deviceName`)이 `X-Device-Name` 을 싣는다 · 가입 응답은 늘 `signUpId` 를 준다(메일 인증을 끈 백엔드만 `CREATED`) · `SignUpScreen.onVerifyCode` 는 필수가 됐고 코드 없는 「링크를 열어 주세요」 갈래는 없다 · 로그인 화면의 「인증 메일 다시 받기」 삭제(재전송은 `signUpId` 로만 — 미인증 계정은 더 만들어지지 않는다).
- **다시 인증 = 계정에 맞는 하나**(`ReauthProof` · `reauthKindOf(reauthSubjectOf(me))`): 비밀번호 · 메일로 받은 6자리를 **그 자리에서** 입력(`CodeEntry`; 틀리면 남은 횟수 · 만료면 새로 받기) · 주소가 없는 계정은 이미 연결된 제공자 동의 왕복(`socialReauth`). 이메일 변경 · 첫 비밀번호 · 소셜 연결 · **연결 해제(이제 다시 인증이 든다)** · 삭제가 같은 부품을 쓴다. 삭제는 별도의 삭제 코드 + 글자 확인.
- **이메일 변경 = 새 주소의 인증번호**: 설정의 코드 단계가 `me.pendingEmail` 로 열려 새로고침을 견디고 `POST /account/email/change/confirm` 로 마친다(다른 세션만 끊긴다). 서버에 취소 엔드포인트가 없어 「코드 다시 받기」는 새 요청이 대신하는 것.
- **제공자 동의 왕복**: `createSocialLinkFlow().start(provider, { accountId, action })` — 하려던 작업과 계정이 OAuth `state` 기록에 묶인다(`ProviderAction` · `SocialLinkContext`; 같은 콜백을 두 번 읽어도 같은 결과 · 다른 계정이 시작한 왕복은 거절 · 로그아웃하면 기록을 비운다). 돌아오면 설정 화면이 하려던 작업을 한 번만 이어서 한다.
- **`AUTH.TOO_MANY_REFRESHES`(429)**: `createSessionRefresher` 가 로그아웃하지 않고 일시 오류로 내보내며 `Retry-After`(없으면 30초 · 연속이면 두 배 · 최대 10분) 동안은 서버를 다시 부르지 않는다. 화면 문구 `errorTooManyRefreshes`.
- **삭제(깨지는 변경)**: `/confirm-reauth` 도착 화면(`ConfirmReauthLanding`) · `BroadcastChannel` 다시 인증 채널과 offer/claim/grant(`createBroadcastReauthChannel` · `listenForReauthToken`) · `resolveReauthLanding` · `createReauthStore` · `submitWithReauth` · `ReauthNotices` · `/confirm-email-change`(`ConfirmEmailChangeLanding`) · 옛 `/verify-email?token=` 도착(`VerifyEmailScreen`) · `reloadLater` · `accountApi.verifyEmail`/`confirmEmailChange`/`resendVerification` · `confirmationToken`(→ `confirmationCode`) · 라우트 옵션 `reauthChannel` · `reauthStore` · `AuthPaths.verifyEmail`/`confirmEmailChange`/`confirmReauth`/`confirmDelete` · `authStorageKeys` 의 `reauthPrefix` · `reauthChannel` · 라벨(`confirmReauth*` · `verifyEmail*` · `confirmEmailChange*` · `reauth{Hint,Sent*,Ready*}` · `deleteMail*`). 링크가 남은 곳은 비밀번호 재설정과 링크 로그인뿐. 오래된 메일의 링크(`/verify-email` · `/confirm-email-change` · `/confirm-reauth` · `/confirm-delete`)는 `LegacyLinkNotice` 한 장(`legacyLinks` 옵션)으로 보낸다. `SocialLinkPasswordScreen` 은 `SocialLinkProofScreen`(세 종류)으로. `PasswordSection` · `EmailSection` · `SignInMethodsSection` · `DeleteAccountSection` 은 `hasPassword` 대신 `subject`(`reauthSubjectOf(me)`) · `requestReauthCode`/`requestDeleteCode` 를 받는다. `@skeleton/ui` `ConfirmDialog` 에 `confirmDisabled`.
- PKCE 는 백엔드가 이번에 미뤘다 — OAuth `state` 검사가 로그인 CSRF 방어다.

### Fixed — 계정 프런트 독립 보안 검토(REVIEW-react) 반영 (2026-10-06)

- **I1 갱신이 로그아웃을 이기지 않는다**: `createSessionRefresher` 가 응답 뒤 저장소를 다시 읽어 보낸 자격과 다르면(로그아웃 · 다른 로그인 · 다른 탭의 로그아웃) 응답을 버리고 `false`(「세션 끝남」 알림 없음).
- **I2 서버 상태 캐시 비우기 한 곳**: `onAccountChange(session, listener)`(로그인한 계정이 사라지거나 바뀔 때 — 로그아웃 · 다른 탭의 로그아웃 · 갱신 실패 · 401 처리기 · 링크 · 소셜로 다른 계정이 들어올 때; 처음 로그인과 같은 계정의 토큰 갱신은 아니다). 세 앱이 `queryClient.clear()` 를 여기에 건다(`apps/*/src/app/queryClient.ts` · starter-ssr 는 `createClientRuntime`). 버튼마다 부르던 `queryClient.clear()` 는 걷었다. 세션이 저장소 둘을 바꾸는 동안 중간 상태가 구독자에게 새던 것도 막았다.
- **I3 다시 인증 보관소가 계정에 묶인다**: `ReauthStore.forAccount(id)`(다른 계정이 적은 하려던 작업 · 토큰은 읽히지 않고 버려진다) · `clear()`(로그아웃) · `peekToken()`/`clearToken()`(호출이 성공한 뒤에만 지운다 — 일시 오류에 토큰 · 작업을 잃지 않는다). 본인 확인 토큰 제안은 **claim → grant 두 단계**라 하려던 작업이 있는 탭이 둘이어도 한 탭만 쓴다(`ReauthChannel.onOffer` 가 `{ claim, take }` 로 바뀌었다). `/confirm-reauth` 는 로그인한 계정에만 의미가 있어 가드 아래로 옮겼다(로그아웃 상태로 열면 로그인한 뒤 돌아온다).
- **I4 소셜 콜백이 백지가 되지 않는다**: 방법을 못 받았거나 그 제공자가 없으면 오류 화면(발견 실패면 「다시 시도」), 쓰이지 않은 인가 코드는 주소창에서 지운다. **I5**: 콜백의 이동 · 「가려던 곳」 읽기를 렌더가 아니라 effect(+ref)로.
- **I6 스타터 저장소 기본을 문서와 맞춘다**: `apps/starter` · `apps/starter-ssr` 의 토큰 저장소 기본이 `localStorage`(+ `crossTab`)로 — 샘플 · README · `.env.example` 이 말하던 대로. 문서와 코드가 어긋나면 `tests/authShells.test.ts` 가 막는다. **마이그레이션**: 스타터를 쓰던 프로젝트는 한 번 로그인이 풀린다(저장소가 바뀐다). 탭마다 따로 로그인하려면 `storage.ts` 를 `sessionStorage` 로(탭 복제가 같은 리프레시 토큰을 둘이 쥐는 점에 주의).
- **I7 실시간 알림이 토큰 만료 뒤에도 산다**: `createSseClient({ recoverUnauthorized, subscribeAuthChanges })` — 401 이면 갱신 한 번 뒤 다시 잇고(되풀이 없음), 토큰이 바뀌면 죽은 스트림을 다시 잇는다. 샘플의 `useLiveNotifications` 가 `refresher.refresh` · `tokenStore.subscribe` 를 건다. STOMP/WebSocket 클라이언트(`createStompNotificationClient`)와 워크벤치의 손으로 넣은 토큰 경로는 이 앱들의 세션 갱신과 이어져 있지 않아 손대지 않았다.
- **M1** 일회용 토큰 · OAuth 코드는 읽은 뒤 `history.replaceState` 로 주소창 · 히스토리에서 지운다(`scrubUrlParams`). 모든 앱 껍데기(`index.html` · 찍힌 프로젝트 포함)에 `<meta name="referrer" content="no-referrer">`. **M2** `TokenLanding` 에 `requireConfirm`: 이메일 인증 · 이메일 변경 링크는 기본으로 「계속」을 눌러야 서버를 부른다(메일 스캐너가 대신 확정하지 못하게); 링크 로그인은 계약대로 도착하면 바로(`requireConfirm={false}`). **M3** 401 처리기(`createUnauthorizedHandler({ refreshStore })`)가 두 저장소를 함께 비운다. **M4** `createAuthSession({ refresher })` — `restore()` 도 single-flight · 탭 락을 거치고 죽은 자격을 비운다; starter-ssr 의 `isRestored()` 는 갱신이 끝난 뒤에 참이 된다(가드가 먼저 로그인으로 보내지 않는다). **M5** `safeReturnPath` 가 제어 문자 · 역슬래시를 거절하고 URL 로 풀어 출처를 확인한다(`'/\t/evil.example'`). **M6** 모듈 전역 제거: `browserReauthChannel` 삭제(앱이 `createBroadcastReauthChannel(keys.reauthChannel)` 를 만들어 `createAuthRoutes({ reauthChannel })` 로 넘긴다), 발견의 경고 기억은 라우트 한 벌마다. **M8** `VITE_AUTH_METHODS` 가 `magic_link` · `magic-link` 둘 다 받는다(`new-project.sh --auth-methods` 도). **M9** 가입 성공 뒤 비밀번호를 state 에서 비움 · 이메일 변경 확인이 무조건 로그아웃시키지 않고 한 번 물어봄 · 삭제 예약 안내가 가드에 가려지지 않게 「로그아웃」 버튼 · 관리자 표 정지 사유를 닫을 때 비움 · `createAuthRoutes` 의 `session` 은 선택.
- **M10 이름공간(마이그레이션 주의)**: 저장 키 · 락 · 채널 이름이 앱 이름으로 나뉜다 — `authStorageKeys(namespace)`(`<ns>.accessToken` · `.refresh` · `.auth.refresh` · `.reauth.` · `.returnTo` · `.social.` · `.social-link.` · `.signUp`), 앱은 `authConfig.ts` 의 `AUTH_NAMESPACE`(sample `sample` · starter `starter` · starter-ssr `starter-ssr`; `new-project.sh` 가 새 이름으로 찍는다). 패키지의 기본 이름공간은 옛 이름 `skeleton` 그대로라 직접 쓰는 곳은 영향 없지만, **세 앱은 옛 `skeleton.*` 키를 더 읽지 않는다 — 배포 후 한 번 다시 로그인한다**. 옛 키는 브라우저에 남는다(원하면 앱이 한 번 지운다).
- **테스트**: 방어를 빼면 실패하도록 고친 것 — 「다시 갱신하지 않는다」(이제 호출 횟수 1), 로그인/연결 state 접두어(같은 저장소에서 서로의 state 를 거절하는지), 일회용 호출 한 번(스토리: 더블클릭 · 마운트 한 번), 새 비밀번호 비저장(진짜 호출부를 거치는 스토리). 새 것: autocomplete 속성 · 삭제의 글자 입력 확인(대소문자) · 소셜 콜백 오류 · 주소창 토큰 지움 · 앱별 캐시 비우기 배선 · 이름공간. 스토리 실행기는 StrictMode 의 이중 effect 를 재현하지 않는다(실측) — 그 경로는 ref 가드와 e2e 가 맡는다.

### Added — 인증번호(6자리) 흐름의 프런트 쪽(초안 — 위 FINAL-3 항목이 확정판) (2026-10-06)

- **`@skeleton/ui` `CodeEntry`**: 6칸 인증번호 입력(숫자 키패드 · 첫 칸 `one-time-code` · 붙여넣기 · 칸 사이 Backspace · 방향키 · 다 채우면 자동 제출 · 오류 · 다시 보내기 쿨다운). 일반 입력 부품이라 `@skeleton/ui`(문구는 모두 prop).
- **`@skeleton/auth`**: `VerifyCodePanel` · 가입 화면의 코드 단계(`onVerifyCode` · `onResendCode` · `initialPending`) · `createSignUpPending`(새로고침을 견딘다 — 10분, 비밀번호는 저장하지 않는다) · `accountApi.verifySignUpCode` · `resendSignUpCode` · `confirmEmailChangeCode` · `ReauthCredential` 의 `confirmationCode` · `socialReauth` · `unlinkIdentity(id, reauth)` · `ACCOUNT.CODE_INVALID` · `CODE_EXPIRED`. 이메일 변경 · 다시 인증 · 삭제 확인의 코드 입력 화면과 제공자 재동의 왕복의 UI 는 아직 옛 링크 방식이다(API 는 준비됨).

### Changed — 계정 프런트를 보안 검토를 거친 백엔드(account-http-contract FINAL-2 · kotlin-skeleton 155bc75)에 맞춘다 (2026-10-06)

- **다시 인증(비밀번호 없는 계정)**: 이메일 변경 · 첫 비밀번호 · 소셜 연결은 `confirmationToken`(없으면 403 `ACCOUNT.REAUTH_REQUIRED`). `createAccountApi.requestReauthConfirmation()`(`POST /account/reauth/confirmation`) · `changePassword` / `changeEmail` / `linkSocial` 이 `confirmationToken` · `currentPassword` 를 받는다. 설정 화면이 하려던 작업을 탭 `sessionStorage` 에 기억하고(`createReauthStore`) 메일 링크의 새 도착 화면 `/confirm-reauth`(`ConfirmReauthLanding`)가 같은 브라우저의 다른 탭에 토큰을 넘기거나(`BroadcastChannel`) 보관해 설정에서 이어 간다. 비밀번호 계정의 소셜 연결은 제공자에 다녀온 뒤 현재 비밀번호를 받는다(`SocialLinkPasswordScreen` · `createSocialLinkFlow().read`).
- **`GET /auth/methods` 발견**: 앱은 로그인 방법 · 가입 열림 · 소셜 제공자(공개 clientId)를 백엔드에서 알아낸다(`discovery` 옵션 · `useAuthMethods` · `loadAuthMethods` 5분 공유) — 로딩 화면(틀린 방법이 깜박이지 않는다) · 실패 시 대체 + 다시 시도. `VITE_AUTH_METHODS` · `new-project.sh --auth-methods` 는 **고정(덮어쓰기)** 으로 바뀌었다(`DEFAULT_AUTH_METHODS` 가 빈 값이면 백엔드가 말하는 대로). 리프레시 전달 방식 불일치는 개발 콘솔 경고.
- `me.pendingEmail` · `pendingEmailExpiresAt` 로 이메일 변경 「확인 대기」를 서버에서 그린다(새로고침 뒤에도) — 서버가 비동기로 채우므로 요청 직후 몇 번 다시 읽는다. 소셜 연결 해제 · 계정 삭제 뒤 세션 목록을 다시 읽는다. 운영자 호출의 403 은 「접근 차단」(로그아웃 없음), 목록은 `size ≤ 100` · `page ≥ 0`. `ACCOUNT.REAUTH_REQUIRED` 코드 · 문구.
- 소셜 연결(병합) 직후 설정에 「계정 주소로 알림 메일을 보냈어요」 안내(`linkedProvider`). 확인된 제공자 이메일이 기존 계정으로 바로 로그인되는 경우(백엔드 `merge-on-verified-email`)와 꺼 둔 경우의 409(`ACCOUNT.SOCIAL_EMAIL_CONFLICT`)를 둘 다 다룬다.
- 갱신 도중 페이지 이동(응답 손실)은 백엔드 `reuse-grace` 가 있으면 이어지고 0s 면 한 번 깨끗이 로그아웃한다 — `refreshNavigation.test.ts`. 쿠키 모드는 한 줄 스위치(`DEFAULT_REFRESH_DELIVERY`) + `cookieDelivery.test.ts`.
- **고침**: 비밀번호 「보기」 토글이 좁은 화면에서 입력칸 아래로 내려가던 것(스토리가 20rem 에서 위치를 잰다).
- **카탈로그 ↔ kotlin 카탈로그**: `newProject.kotlin`(usage · `--dry-run` · starterModules)을 kotlin 의 것과 같게, 앱 항목의 모듈 닫힘 · basePaths, `/ws/notifications` 제거, payment 문서. `scripts/capabilities.d/siblingCheck.mjs` 가 옆 레포를 읽기만 해 양방향으로 맞는지 본다(`tests/capabilities.skeleton.test.ts`).
- **e2e**: 준비 단계가 자체 mailpit 을 띄우지 않고 백엔드 `scripts/sample-e2e-backend.sh` 가 올린 것(`MAIL smtp=… api=…` 줄)을 쓴다. 새 여정: 방법 발견 · 갱신 중 이동 · 이메일 변경 확인 대기(새로고침 뒤) · 모든 세션 종료 · 비밀번호 없는 계정의 본인 확인 왕복(다른 기기 · 새 탭 · 첫 비밀번호) · 운영자 목록 페이징 거절.

### Added — 계정 수명주기 프런트: 토큰 자동 갱신 · 가입/메일 인증/재설정/링크 로그인/계정 설정 화면 · 라우트 한 벌 · 선택 관리자 표 (2026-10-06)

백엔드 kotlin-skeleton `docs/account-http-contract.md`(account · auth-session · auth-magic-link) 짝. 로그인 방법은 앱 설정으로 켜고 끈다(비밀번호 · 이메일 링크 · 소셜).

- **`@skeleton/api-client`**: 계정 · 세션 에러 코드 25개(`AUTH.EMAIL_NOT_VERIFIED` … `ACCOUNT.METHOD_UNKNOWN`) · `retryAfterSeconds(error)`(429 본문 `data.retryAfterSeconds`, 없으면 `Retry-After`) · `createApiClient({ recoverUnauthorized, withCredentials })` — 인증이 붙은 요청이 401 이면 훅 한 번, true 면 같은 요청을 **한 번만** 다시 보낸다(`skipAuth` 요청은 제외 · 훅이 던진 에러는 그대로 나간다).
- **`@skeleton/auth` 세션 층**: `createSessionRefresher`(401 갱신 single-flight · 새 리프레시 토큰을 먼저 저장하는 회전 안전 · 다른 요청 · 탭이 이미 갱신했으면 호출 없이 재사용 · `navigator.locks` 로 탭 줄 세우기 · 재사용 · 만료 · 정지면 두 저장소 비우고 `onSessionEnded`) · `createRefreshStore` · 저장소 `crossTab`(`storage` 이벤트)와 `reload()` · `createAuthApi` 에 `refresh` · `logout` · `magicLinkRequest/Redeem` · `X-Device-Name` · 쿠키 모드(`X-Requested-With`) · `createAuthSession` 의 `restore()` · `signIn()` · `magicLinkLogin()` · 로그아웃은 이 기기를 먼저 비우고 서버에 알린다. `body`(기본) · `cookie` 둘 다. 서버 렌더에서 import 때 브라우저 전역을 읽지 않는다.
- **`@skeleton/auth` 화면 · 라우트**(`@skeleton/ui` 만 사용 · 문구는 `labels` prop — 기본 영어, `koAuthLabels`): `SignInScreen`(`methods` 설정이 비밀번호 · 소셜 · 이메일 링크를 정한다 · 미인증 다시 보내기 · 429 카운트다운) · `SignUpScreen`(서버 정책 체크리스트 · 강도 · 캡차 슬롯 · 약관 동의 슬롯이 체크한 판을 콜백으로 보고) · `CheckEmailPanel` · `VerifyEmailScreen` · `MagicLinkLanding` · `ConfirmEmailChangeLanding`(토큰은 `#token=` 우선 `?token=`, 열자마자 한 번만 호출 — StrictMode 안전) · `ForgotPasswordScreen` · `ResetPasswordScreen` · `SocialCallbackScreen`(이메일 충돌 안내) · `AccountStateNotice`(정지 · 차단) · `AccountSettings`(프로필 언어 · 시간대, 비밀번호, 이메일 변경 확인 대기, 로그인 수단 연결/해제와 마지막 수단 보호, 세션 하나씩 · 한꺼번에, 계정 삭제 = 다시 인증 + 글자 입력 확인 + 유예 안내) · `RequireRole` · 로그인 뒤 돌아가기(`postSignInTarget` — 같은 출처 경로만) · `createAuthRoutes`(한 번에 `/login` `/sign-up` `/verify-email` `/forgot-password` `/reset-password` `/magic-link` `/auth/callback` `/confirm-email-change` `/account` `/confirm-delete`; 가입 · 재설정 · 링크 로그인은 끄고 켠다, 서버 렌더 앱은 `useApis` · `guard`) · `createSocialLinkFlow`(로그인한 계정에 제공자 더하기 — `state` 는 탭의 `sessionStorage` 에 묶고 없거나 다르면 요청 전에 거절, 두 번 와도 한 번).
- **선택 내보내기 `@skeleton/auth/admin`**: `AdminAccounts` · `AdminAccountsTable`(검색 · 상태 필터 · 정지 사유 · 해제 · 삭제 유예 복구 · 역할) · `createAdminAccountsApi`.
- **스토리 · Patterns**: `Patterns/Auth/*` 5개(로그인 · 가입 · 메일 링크 도착 · 계정 설정 · 운영자 표) — 모든 스토리에 `play`, 다크 변형, a11y 통과.
- **앱**: `apps/sample`(가입 → 인증 → 로그인 → 설정 → 삭제 여정 · 랜딩 「시작하기」 → 가입 · 운영자 표 `/admin/accounts` · 인증 화면 `noindex` + robots.txt · 한국어 `koAuthLabels`, 영어는 기본), `apps/starter` · `apps/starter-ssr`(같은 라우트 한 벌 — 로그인 · 계정 화면을 자체 구현하던 `LoginPage` · `AccountPage` 를 대체). 켜는 방법 `VITE_AUTH_METHODS`(기본 `password,magic-link`) · `VITE_SOCIAL_<제공자>_CLIENT_ID` · `VITE_AUTH_REFRESH_DELIVERY`.
- **e2e**(`apps/sample/e2e/account.e2e.ts`): 진짜 백엔드 + 메일 캐처(mailpit, 준비 단계가 빈 포트로 띄워 `MAIL_SMTP_PORT` 로 알려 준다) — 가입(정책 힌트) → 인증 전 로그인 거절 → 메일 링크로 인증(한 번만) → 로그인 → 깨진 액세스 토큰이 갱신 한 번으로 이어짐(리프레시 토큰 회전) → 비밀번호 변경 → 다른 기기 세션 끊기 → 프로필 → 삭제 → 링크 로그인 → 운영자 표.
- **`new-project.sh --auth-methods a,b`**: 새 프로젝트의 로그인 방법 기본값을 `src/auth/authConfig.ts` 에 심는다. 카탈로그에 `account-lifecycle` · `session-refresh` · `magic-link-login` · `account-admin` 항목과 결정표 3행. `@skeleton/auth` 는 이제 `@skeleton/ui` 를 런타임 의존으로 갖는다(`needs`).
- 변경: 비밀번호 정책 응답은 컨트롤러의 `maxBytes`(계약 문서는 `maxLength`)를 둘 다 받는다. 이메일 변경 확인은 서버가 모든 세션을 닫으므로 이 기기도 로그아웃으로 다룬다. `AuthApi` 에 메서드가 늘었다(`refresh` · `logout` · `magicLinkRequest` · `magicLinkRedeem`) — 가짜 `AuthApi` 를 쓰는 테스트는 채운다. `AuthSession.logout()` 은 Promise 를 돌려준다.

### Added — LLM 이 읽는 기능 카탈로그: 「무슨 기능이 준비됐는지」를 보고 세팅을 시킨다 (2026-10-06)

- **`capabilities.json`(정본) · `docs/capabilities.schema.json`**: 패키지 15 · 앱 5 · 패턴 8 · 스크립트 4 = 32개 항목. 항목마다 `id` · `summary`(한 문장) · `kind` · `package`/`path` · `status`(stable · experimental · template-only) · `stampFlag`(`new-project.sh` 조각 · 자동으로 따라오는 패키지 · `--ssr`/`--with-sample` 로도 오는지 · 빼는 옵션) · `needs` · `backend`(짝 kotlin-skeleton 모듈 · 택일 묶음 · 선택 모듈 · 기본 경로, 프런트만이면 `null`) · `entryPoints` · `stories` · `patterns` · `docs` · `notFor` · 한국어/영어 `keywords`. 최상위에 「필요한 것 → 고를 것」 행(`decisions` 23)과 레시피 작업 예(`examples` 3), 두 레포의 `new-project.sh` 인터페이스(`newProject`).
- **생성물**: `docs/capabilities.md`(결정표 + 전체 목록 + 항목 상세) · `llms.txt`(짧은 색인). `scripts/build-capabilities.mjs` 가 만들고(`pnpm capabilities`) `--check`(`pnpm capabilities:check`, CI `build` 잡)가 어긋남을 잡는다. 명령 조각은 손으로 적지 않고 `stampFlag`/`backend` 에서 계산한다.
- **가드**(`tests/capabilities.test.ts` · `tests/capabilities.skeleton.test.ts`): 모든 `packages/*` · `apps/*` 에 항목이 있고(없으면 어떤 객체를 더하라고 출력하며 실패) 항목마다 폴더가 있다 · `package` 이름이 package.json 과 같다 · 나열한 export 가 패키지 `src/index.ts`(하위 경로 포함)에 있다 · 스토리 · 패턴 · 문서 · 파일 경로가 있다 · `needs` = package.json 의 런타임 `@skeleton/*` 의존 · `stampFlag` 가 `new-project.sh`(`stamp.mjs plan`)의 실제 동작과 같다(옵션 · 패키지 이름 · 닫힘 · `alsoVia`) · 한국어/영어 키워드가 둘 다 있다 · 생성물이 최신이다 · 스키마(작은 검사기). kotlin-skeleton 이 옆에 있으면 `backend` 모듈 이름이 그쪽 색인에 있는지도 본다.
- **`docs/new-project-recipe.md`**: 제품 한 문단 → 결정표 → 두 레포의 `new-project.sh` 명령 → 설정 → 실행(`scripts/dev.sh`) → 화면마다 복사할 Pattern → 검증 → 배포, 작업 예 3개(커뮤니티 · 유료 SaaS · SSR 콘텐츠 사이트). 예의 명령은 카탈로그에서 계산한 것과 같아야 하고(테스트), `test-new-project.sh` 가 적힌 그대로 찍어(`--quick`) 돌린다(`--full`).
- **카탈로그가 따라간다**: `new-project.sh` 가 고른 것만 남긴 `capabilities.json`(`mode: project` — 앱 항목은 새 이름 · 없어진 파일 경로는 걷고 · 빠진 것은 `omitted`)와 `docs/capabilities.md` · `llms.txt`, CLAUDE.md/README 의 「먼저 읽는다」 안내를 프로젝트에 쓴다. 생성 · 가드는 따라가고 스켈레톤 전용 가드 · 레시피는 지운다. `test-new-project.sh` 에 구역 11(카탈로그) · 12(레시피 예)와 `--full` 의 `capabilities:check` 단계 · 레시피 예 세 조합을 더했다.
- CLAUDE.md: 「만들기 전에 — 무엇이 이미 있는지부터」(`llms.txt` → `capabilities.json` 을 먼저 읽는다). 패키지 · 앱을 더하면 카탈로그 항목도 더한다.

### Added — 「도메인만 바꿔 켜면 서비스 구색이 나온다」를 위한 프런트 부품: `@skeleton/seo` · `@skeleton/marketing` · `@skeleton/ui` 13개 (2026-10-06)

백엔드 API 가 새로 필요 없는 조각만. 모든 부품은 스토리 + `play`(a11y 위반도 실패) · 카탈로그 한 줄 · SSR 서버 렌더 확인 · 라이트/다크를 갖췄고, 새 런타임 의존은 **0**.

- **번들 영향(측정, `vite build` gzip · 같은 머신 · 이전 HEAD bf7a108 대비)**: `apps/starter` JS 145.55 → 145.52 kB — **변화 없음**(안 쓰는 부품은 트리 셰이킹으로 빠지고 ui 가 time 에 의존해도 `DatePicker` 를 안 쓰면 들어오지 않는다). `apps/sample` JS 183.37 → 198.60 kB(+15.2) · CSS 6.03 → 8.00 kB(+2.0) · 영어 사전 3.27 → 4.80 kB(+1.5) — 랜딩 · 요금제 · 약관 템플릿 문서 8개 · 동의 배너 · SEO 가 들어온 값이다(`MarkdownView` 파서 · 문서 파일 포함).

- **`@skeleton/ui`(새 부품)**: `Skeleton` · `Avatar` · `Breadcrumbs` · `Alert` · `CopyButton` · `Tooltip`(WAI-ARIA) · `Stepper` · `ConfirmDialog`(문구를 정확히 쳐야 켜지는 확인 선택 · 처음 포커스는 취소) · `InfiniteList`(끝에 닿으면 자동 + **언제나** 키보드 「더 보기」 버튼 · 실패하면 멈추고 다시 시도 · 버튼이 사라질 때 포커스 보존) · `Combobox`(WAI-ARIA 자동완성, 정적 목록 거르기 또는 비동기 `loadOptions(query, signal)` — 디바운스 · 중복 요청 취소 · **늦게 온 옛 응답은 버린다** · 악센트 · 한글 NFC/NFD 무시) · `DatePicker`/`DateRangePicker` · `MarkdownView`.
  - `DatePicker` 는 **네이티브 `<input type="date">`** 위에 만들었다: 달력 팝업 · 키보드 · 모바일 선택기 · 지역화를 브라우저가 이미 접근성 있게 해 주고, 직접 만든 달력은 그 전부를 다시 만들어야 한다(번들 0). 보탠 것은 고른 날을 글로 읽어 주기(`@skeleton/time` 의 `formatDate` — 달력 날짜는 시간대로 옮기지 않는다)와 시간대에 맞는 「오늘」 버튼(`todayInZone`), `min`/`max`. 기간은 시작 ≤ 끝을 서로의 `min`/`max` 로 묶고 거꾸로 쳐 넣으면 끝칸에 오류.
  - `MarkdownView`(법적 문서용 **안전한 부분집합**): 제목 · 문단 · 목록(한 단계 중첩) · 강조 · 코드 · 링크 · 표 · 구분선만. **`dangerouslySetInnerHTML` 이 없다** — 날 HTML · 이미지는 보이는 글자로 남는다. 링크는 `http(s)` · `mailto` · `tel` · `/경로` · `#앵커` 만(`java\tscript:` 같은 우회 · `//host` · `data:` 는 글자만 남김), 바깥 링크는 새 탭 + `rel="noopener noreferrer"` + 보이지 않는 「새 탭」 안내. `{{키}}` 는 `facts` 에서 **글자로만** 채운다(값에 마크다운 · HTML 이 있어도 구조가 되지 않고, 주소 안의 `{{키}}` 는 채운 뒤 다시 검사) — 못 채운 키는 노란 표시로 남아 빈 문서가 공개되지 않는다. 2000개 무작위 적대 입력 속성 시험(씨앗 고정 · 라이브러리 없음)이 허용 태그 · 속성 · href 를 지킨다(검증기를 일부러 풀어 보면 이 시험이 실패한다).
  - `RowMenu` 는 일반 드롭다운으로도 쓴다 — `align`(start · end, 넘치면 반대쪽) 추가, 헤더 계정 메뉴(아바타 트리거 · 하나 고르기 묶음 · 위험 항목) 스토리. 별도 `DropdownMenu` 는 만들지 않았다(같은 일을 하는 두 번째 메뉴가 된다).
  - `@skeleton/ui` 가 `@skeleton/time` 에 의존한다(날짜 입력). `@skeleton/time` 에 `todayInZone(zone, now?)` 추가.
- **`@skeleton/seo`**(새 패키지, 의존 0): `buildHeadSpec`(제목 템플릿 · 설명 · canonical(절대 · 해시 제거) · `og:*` · `twitter:*` · hreflang · JSON-LD) 한 규칙을 서버는 `renderHeadHtml`(이스케이프된 글자), 브라우저는 `applyHead`/`useSeo`/`<Seo>`(`data-seo` 태그만 갈아 끼운다)로 쓴다. JSON-LD 직렬화는 `< > &` · U+2028/9 를 이스케이프해 값에 `</script>` 가 있어도 빠져나가지 못한다. `sitemapXml`(같은 호스트 · 중복 · 날짜 · 우선순위 · 5만 개 검사) · `robotsTxt`(줄을 늘리는 개행 값은 던진다 · `allowIndexing:false` 로 스테이징 전체 차단) · `@skeleton/seo/vite` 의 `seoFiles`(정적 빌드가 `sitemap.xml` · `robots.txt` 를 낸다 — 서버 번들 빌드에는 안 쓴다).
  - **`apps/starter-ssr`**: 머리를 `@skeleton/seo` 로(canonical · OG/Twitter · robots), 라우트 `handle` 에 `image` · `jsonLd`, `SITE_URL`(공개 주소 — 없으면 canonical · `og:url` 을 **빼고** 추측하지 않는다 · 빌드의 sitemap.xml 에도), 브라우저는 서버가 알려 준 공개 주소로 라우트 전환 때 같은 머리를 쓴다. `applyDocumentMeta` 는 `applyHead` 로 대체. **`--ssr` 로 찍으면 `seo` 가 따라온다**(SPA 스타터는 아니다).
- **`@skeleton/marketing`**(새 패키지, 의존 `ui` · `time`, 외부 의존 0): `Hero` · `FeatureGrid` · `Testimonial` · `CtaBand` · `SiteFooter` · `FaqAccordion`(네이티브 `<details>`) · `PricingTable`(요금제 **데이터** · 월/연 토글 + 절약 % · 강조 · 0원 · 맞춤 가격 · 통화 · 로케일 명시) · 동의(`createConsentStore` — `localStorage` · 구독 · `onChange` · 버전이 바뀌면 다시 묻기 · 필수 범주는 못 끈다 · 저장이 막혀도 동작 / `ConsentBanner` — 모두 거부 = 모두 허용과 같은 무게 · 서버에는 안 그린다 · **추적 코드 없음**) · `LegalDocumentPage`(판마다 마크다운 + 효력일 · 판 바꾸기 · 옛 판 안내 · 템플릿 표시) · `NotFoundPage` · `ServerErrorPage`(참조 번호) · `MaintenancePage`. Patterns 4개(`Patterns/Landing` · `Pricing` · `LegalDocument` · `NotFound`)는 패키지 옆 `src/patterns/` — 패키지와 함께 찍힌다.
  - **ui 가 아니라 별도 패키지인 이유**: `ui` 는 어느 앱에나 가는 낱개 부품이고 이것은 한 페이지의 **구역**과 그 구역의 저장소다 — 로그인 뒤 앱에는 필요 없다. 별도라서 `--packages marketing` 으로 고른 프로젝트에만 따라간다.
- **`apps/sample`**: 로그아웃 상태의 `/` 는 **랜딩**(로그인하면 대시보드, `HomeRoute`) · `/terms` · `/privacy` 는 **템플릿** 문서(ko · en 각 두 판, 파일에서 읽고 `?v=` 로 판 공유 · 맨 위 TEMPLATE 표시 · 사실은 `legal/facts.ts` — 모든 판이 TEMPLATE 를 말하고 안 채운 `{{키}}` 가 없는지 테스트가 지킨다) · 진짜 404 화면 · 푸터 · 동의 배너(분석 코드는 넣지 않았다) · 모든 라우트의 `handle.seo`(공개 3개는 노출, 로그인 · 로그인 뒤 · 404 는 `noindex, nofollow`) · 빌드가 `sitemap.xml` · `robots.txt`(`VITE_SITE_URL`). 화면 → Pattern 지도 · e2e 여정(랜딩 → 동의 → 약관 판 바꾸기 → 404 → 로그인)을 갱신했다.
- **`new-project.sh`**: `--packages seo,marketing` 가 `ui` · `time` 으로 닫혀 찍힌다(고르지 않으면 카탈로그에도 없다). `test-new-project.sh` 에 빠른 점검 구역(4c)과 `--full` 의 일곱 번째 조합(`seo,marketing` + `storybook:build` · `test:stories`)을 더했다.
- 바뀐 것(호환 주의): 샘플의 `/` 는 로그아웃 상태에서 로그인으로 리다이렉트하지 않고 랜딩을 그린다(e2e 의 `signIn` 은 랜딩의 「로그인」 링크로 들어간다). 샘플의 `notFound.home` 문구는 「대시보드로 가기」 → 「홈으로 가기」.

### Fixed — 빌드 · 테스트가 0% CPU 로 영원히 멈추던 rolldown 교착 (vite 8.0.9 → ^8.3.2) + 워치독 (2026-10-06)

- **측정**(macOS arm64 · Node 24.19 · 깨끗한 복사본, 시도마다 60초 감시): 같은 명령을 반복해 멈춘 비율을 쟀다.

  | 구성                                                                         | `pnpm build`         | 루트 `vitest run --pool forks` |
  | ---------------------------------------------------------------------------- | -------------------- | ------------------------------ |
  | vite 8.0.9 · rolldown 1.0.0-rc.16 · vitest 4.1.8 (이전)                      | **5/65 멈춤 (7.7%)** | **2/175 (1.1%)**               |
  | 같음 + `ROLLDOWN_WORKER_THREADS=1`                                           | 0/40                 | —                              |
  | **vite 8.3.2 · rolldown 1.2.12 · vitest 4.1.11 · plugin-react 6.1.2 (지금)** | **0/120**            | **0/450**                      |

  멈춘 프로세스의 `sample` 은 rolldown 워커 스레드 18개가 전부 `_pthread_cond_wait`, 메인 스레드는 `kevent` 에서 대기(CPU 0%) — `vite build --ssr` 를 시작하는 두 번째 번들 등에서 난다. 심볼이 없는 바이너리라 원인 줄까지는 못 찍었다: 네이티브 바인딩의 경합으로 `bundle.generate()` 가 영원히 끝나지 않는 증상이고, 같은 머신의 다른 레포(lindorm-io/monorepo #247 · #253)가 같은 버전에서 독립적으로 재현해(1%, 0/2400 으로 8.3.2 · 8.0.11 에서 사라짐) 일치한다. 환경변수 `ROLLDOWN_WORKER_THREADS=1` 도 효과가 있었지만(0/40) 모든 명령에 붙일 수 없어 버전을 올리는 쪽을 골랐다. Vite 7(rollup)로 내릴 필요는 없었다. 열린 upstream 이슈: rolldown/rolldown#10695(vite 8.x 대형 빌드 교착, 미해결).

- 올린 것: `vite ^8.3.2` · `@vitejs/plugin-react ^6.1.2` · `vitest ^4.1.11` · `@vitest/browser-playwright 4.1.11`(vitest 와 같은 버전이어야 한다). 루트 `package.json` 한 곳이 정본이라 `new-project.sh` 로 찍은 프로젝트와 CI 에 그대로 흐른다. 8.0.0–8.0.15 는 `npm audit` 에서 high 였다.
- **`scripts/with-watchdog.mjs`**(의존성 없음): `node scripts/with-watchdog.mjs [--wall 초] [--idle 초] [--retries n] -- <명령>` — 한 시도가 `--wall` 을 넘기거나 `--idle` 동안 출력도 CPU 도 없으면 프로세스 그룹째 죽이고 다시 돈다. 끊김만 재시도하고 스스로 실패한 명령은 그 종료 코드를 그대로 준다(재시도를 다 쓰고도 멈추면 124). 단위 테스트 `tests/withWatchdog.test.ts`(진짜 자식 프로세스: 멈춤 → 죽임 → 재시도 → 종료 코드, 진짜 실패는 한 번만, 바쁜 CPU · 계속 출력하는 프로세스는 안 끊음, 손자까지 죽임)
- `scripts/test-new-project.sh --full` 의 조합별 단계가 워치독을 거친다(단계당 15분 · 무활동 3분, 내려받기는 시간 한도만). `apps/sample` 의 `pnpm e2e` 는 워치독으로 감싸고, e2e 의 Vite 서버는 30초 안에 응답이 없으면 죽이고 새로 띄운다(최대 3번). README 「알려진 함정」 · CLAUDE.md 에 주의 추가

### Added — `@skeleton/i18n` · `@skeleton/ui` 설정/오류 부품 5개 + `LanguageMenu` · SSE 클라이언트 하드닝 (2026-10-06)

실사용 프로젝트 웹의 일반화할 수 있는 아이디어를 스켈레톤 규칙(토큰 · prop 문구 · 스토리 + play · SSR 안전)에 맞게 다시 만들었다 — 파일을 옮기지 않았고 프로젝트 이름 · 저장 키 · 문구는 없다.

- **`@skeleton/i18n`**(새 패키지, 외부 의존 `intl-messageformat` · `@formatjs/icu-messageformat-parser`): `createI18n({ catalogs, defaultLocale, storageKey })` — ICU 메시지(`t` · `tIn` · 요소가 낀 `tRich`), 언어 감지(저장한 선택 → `navigator.languages`(전체 태그 → 주 태그) → 기본)와 저장, 지연 사전(`en: () => import('./en')`, 도착한 뒤에 바뀜 · 늦게 부른 호출이 이김), 서버 렌더 안전(만들 때 브라우저 API 를 읽지 않는다, 첫 렌더는 기본 언어, `init()` 은 브라우저에서 명시적으로), 없는 키는 기본 언어 문구 → 키(+`onMissingKey`). `I18nProvider` · `useT()` · `detectLocale`. 테스트 도구 `@skeleton/i18n/testing` 의 `catalogProblems(catalogs, { defaultLocale })`(같은 키 · ICU 로 읽힘 · 인자 일치 · ICU 문법 옆 ASCII 아포스트로피 · 빈 문구)를 앱이 자기 테스트에서 부른다. 부품(`@skeleton/*`)은 i18n 을 모르고 라벨은 계속 prop — 앱이 번역해 넘기는 법은 `packages/i18n/README.md`. 스토리 `Packages/i18n`
- **`@skeleton/ui`**: `LanguageMenu`(i18n 라이브러리를 모르는 순수 부품이라 ui 에 둔다 — 자기 말로 쓴 선택지 · `lang` 속성), `RowMenu`(WAI-ARIA 메뉴 버튼: ↑↓ Home End · Esc · 바깥 클릭 · Tab 으로 벗어나기 · 포커스 돌려주기 · 자리가 모자라면 위로 · 화면 가장자리에서는 반대쪽 정렬로 열기), `SwitchRow`(줄 전체가 라벨인 설정 스위치 · `busy`), `SectionCard`(접이식 절) + `SectionIndex`(절 목차 · 포커스 이동 · 현재 절), `ErrorReference`(참조 번호 + 복사 · `role="status"`). 스토리 + `play` + 카탈로그 + SSR fixture. 설정 Pattern 이 목차 · `SwitchRow` · 접이식 기기 목록 + `RowMenu` · 저장 실패 시 참조 번호를 보인다
- **`showApiError`**: 참조 번호(traceId)를 **돌려준다** — 상태에 담아 `<ErrorReference reference=… />` 로 그리면 토스트가 사라진 뒤에도 남는다. 토스트의 traceId 는 클릭 전용 `div` 가 아니라 키보드로 닿는 복사 버튼이 되었다(`messages.copy` 추가)
- **`@skeleton/realtime` `createSseClient`**: 탭이 숨겨지면 끊고(`paused`) 보이면 곧바로 잇는다 · `idleTimeoutMs`(기본 꺼짐 — 서버 심장박동 주기보다 길게 줄 때만) · 401 · 403 · 404 는 `off` 로 영구 중지 · 429 · 503 은 `busyDelayMs`(30초) 뒤에, `Retry-After` 가 더 길면 그만큼(상한 `maxRetryAfterMs`) · `onOpen({ reconnect })`. `RealtimeStatus` 에 `paused` · `off` 가 더해졌다(SSE 만 낸다)
- **`apps/sample`**: 글자를 `src/strings.ts` 에서 `src/i18n/ko.ts` + `en.ts`(지연)로 옮겼다 — 헤더에 언어 메뉴, 언어를 바꾸면 그 자리에서 다시 그리고 `notes:ui-locale` 에 저장. 카탈로그 짝 맞춤 테스트. 불러오기 실패 카드에 참조 번호 + 복사. `scripts/new-project.sh --packages i18n` 이 되고(샘플이 쓰므로 `--with-sample` 은 자동), `test-new-project.sh` 조합 2 가 i18n 을 포함한다
- **바뀐 동작(호환 주의)**: 503 은 더는 빠른 재시도가 아니라 느린 재시도(`createSseClient`) · `showApiError` 토스트의 traceId 마크업이 바뀌었다(`traceId: <id>` 한 글자열 → 이름 · 번호 · 복사 버튼)

### Added — `@skeleton/board`(게시판: 글 · 대댓글 · 타입이 있는 반응) + 샘플의 「게시판」 + 반응 종류를 서버 설정으로 늘리는 구조

백엔드 `modules/board`(+ `board-jdbc`)의 HTTP 계약(`/api/v1/boards`)을 겨냥하는 12번째 패키지. 소유자의 방향: 좋아요/싫어요만이 아니라 「공감」 같은 반응을 코드 변경 없이 늘릴 수 있게 **반응 종류는 서버가 알려 주는 코드**이고 패키지는 종류를 열거하지 않는다.

- `@skeleton/board` — `createBoardApi(client, { basePath = '/boards' })`(모든 엔드포인트, 만들기에 `Idempotency-Key`) · TanStack Query 훅(`useBoardConfig` · `usePosts` · `usePost` · `useComments` · 글/댓글 쓰기 · `useReaction`) · 키는 `board` 한 뿌리 · **반응은 낙관적 갱신 + 실패하면 되돌림**(SINGLE · PER_TYPE 모두 서버와 같게 셈, 서버 집계가 오면 그것이 이긴다) · `nestThread`(서버가 평평하게 준 자손 → 트리) · 컴포넌트 `ReactionBar`(`labels` · `icons` 맵 — 새 종류는 맵 한 줄) · `PostList` · `PostDetail` · `PostEditor` · `CommentThread`(깊은 답글 접기 `collapseFromDepth`, 지운/숨긴 자리 표시 문구 prop, 운영자 숨김) · 서버와 이은 `BoardComments` · `PostReactionBar`. 글자는 전부 prop(기본 영어), 색은 의미 토큰, SSR 안전
- 스토리 7개(`play` + a11y) + 계약을 따르는 메모리 가짜 서버(`src/stories/fakeBoard.ts`, 자체 테스트) + 게시판 한 벌 조립 스토리(`BoardPage.stories.tsx`), 「공감」 스토리. `docs/ui-catalog.md` 에 줄 추가, `tests/support/ssrFixtures.ts` 에 컴포넌트 · 훅 줄 추가
- `@skeleton/api-client`: `ErrorCodes.BOARD_*`(10개 — 백엔드 `BoardErrorCode` 와 같다)
- `apps/sample`: 「게시판」 메뉴 · 화면 셋(`/board` 목록 · `/board/:id` 글 + 반응 + 댓글 · `/board/new` · `/board/:id/edit`) — 반응 라벨 맵 `{ LIKE: '좋아요', DISLIKE: '싫어요', EMPATHY: '공감' }`, 운영자(`config.canModerate`)의 고정 · 숨김. 브라우저 e2e `e2e/board.e2e.ts`(글 → 반응 바꾸기 → 댓글 → 대댓글 → 접힘 → 운영자 숨김)와 증거 스크립트 `e2e/walkthrough.board.shots.ts`
- `scripts/new-project.sh --packages board`(→ `ui` · `api-client` · `time` 으로 닫힘), `--with-sample` 은 board 도 가져온다. `test-new-project.sh --full` 에 `--packages board` 조합(`storybook:build` · `test:stories` 포함) 추가

### Added — 참조 앱 `apps/sample`(Notes) · `@skeleton/ui` 5부품 · Dashboard Pattern · 브라우저 e2e (2026-10-05)

"이 스켈레톤으로 이런 제품이 나온다"를 한 화면 흐름으로 보이는 작은 실제 앱. 로그인 → 대시보드(현황 · 최근 노트 · 안 읽은 알림) → 목록(검색 · 필터 · 쪽 · 빈/로딩/오류) → 상세(탭 · 삭제 확인) → 만들기/수정(백엔드 400 을 칸별로) → 첨부 업로드(진행률) → 알림 종 + 실시간 → 설정(테마 · 계정) → 로그아웃. 백엔드 짝은 kotlin-skeleton `apps/sample`(`/api/v1/notes`).

- `apps/sample` — Patterns 를 조립한 화면(화면 → Pattern 지도와 조립 메모는 `apps/sample/README.md`), 글자는 `src/strings.ts` 한 곳, 서버 상태는 TanStack Query(`notes/queries.ts`), HTTP 는 `notes/notesApi.ts` 한 곳, 목록 조건은 주소 검색 인자(`listParams.ts`), 만들기는 요청 내용마다 `Idempotency-Key`(같은 내용 재전송은 같은 키, 고쳐 보내면 새 키 — 서버는 같은 키 다른 본문에 409). 단위 테스트(API 모양 · 쿼리 키 · 폼 오류 매핑 · 업로드 문구 · 주소 인자 · 라우트 가드)
- 브라우저 e2e `pnpm e2e:sample`(Playwright + vitest, 새 의존 없음) — `e2e/globalSetup.ts` 가 kotlin-skeleton `scripts/sample-e2e-backend.sh` 로 DB · 로컬 S3 · 백엔드를 빈 포트에 올리고 Vite 를 띄운 뒤 끝나면 모두 내린다. CI `sample-e2e` 잡(타임아웃 30분). `E2E_WALKTHROUGH=1 pnpm --filter sample walkthrough` 는 여정 스크린샷 · 녹화
- `@skeleton/ui` 새 부품: `PageHeader` · `Badge` · `Progress` · `FilePicker`(날 `<input type=file>` 이 금지라) · `Stat` — 스토리 + `play` + SSR fixture. `AppShell` 이 현재 링크(`aria-current="page"`)를 칠하고 좁은 화면(≤640px)에서 메뉴가 둘째 줄로 내려간다(컨테이너 쿼리, props 불변). `Button` 라벨이 줄바꿈하지 않는다. `Dialog` 의 머리 · 바닥은 `<header>` · `<footer>` 가 아니라 `<div>`(대화상자 안에서는 최상위가 아닌 banner · contentinfo 랜드마크가 되어 axe 가 지적했다)
- 새 Pattern `Patterns/Dashboard page`(숫자 4칸 + 최근 항목 표 + 알림 카드 · 로딩 · 오류 · 첫 사용). 목록 · 상세 · 폼 · 설정 Pattern 이 `PageHeader` 로 시작한다
- `@skeleton/api-client`: `client.noContent(path, request)` — 204(백엔드 `Response.noContent()`: 삭제 · 명령 완료)는 본문이 없어 `basic` 이 검증에 실패했다. `@skeleton/theme`: `ThemedToaster({ position })`(기본 `top-right` 그대로, 헤더 액션을 덮지 않게 `bottom-right`)
- `scripts/new-project.sh`: 샘플은 **기본으로 넣지 않는다**, `--with-sample` 이면 남긴다(이름 `sample` 예약). 루트 스크립트 `dev:sample` · `e2e:sample`, CLAUDE.md 「새 기능의 정본 예시」

### Changed — 백엔드 모듈이 받은편지함 · 업로드 HTTP 를 연다: 기본 경로가 생겼다 · 풀스택 한 줄 실행 (2026-10-05)

새 프로젝트 드릴(스켈레톤 두 개로 찍어 브라우저에서 알림 · 업로드 · 잡 · 시간 · 인증을 눌러 봄)에서 앱이 직접 써야 했던 컨트롤러(받은편지함 142줄 · presign 70줄)를 kotlin-skeleton 모듈로 옮겼고, 패키지는 그 경로를 기본으로 한다.

- `@skeleton/storage`: `storageEndpoints(basePath = '/storage')`(모듈의 `/api/v1/storage/*` 전부) · `createStorageApi(client)` 의 `endpoints` 기본값이 그것 — 한 줄로 presign · validate · download · multipart 가 모두 생긴다. 새 `download` 엔드포인트 → `api.presignDownload(key)` · `publicUrlFromDownload(api)`(비공개 버킷에 올린 파일을 짧은 수명 GET 주소로 연다). 기존 `endpoints` 를 직접 주는 호출은 그대로 동작한다
- `@skeleton/notifications`: 기본 `basePath`(`/notifications`)는 그대로이고, 이제 그 경로를 워크벤치 데모가 아니라 백엔드 `modules/notification` 이 연다(README · 주석)
- `@skeleton/api-client`: `ErrorCodes` 에 `STORAGE_FILE_REJECTED`(`data.errors` 에 사유) · `STORAGE_OBJECT_NOT_FOUND` · `STORAGE_UNAUTHENTICATED`
- `scripts/new-project.sh`: 레포 안에서 `../내-프로젝트` 처럼 상대 경로로 부르면 "target must be outside the skeleton repo" 로 거부되던 것을 고쳤다(경로를 정리한 뒤 비교)
- 앱(`starter` · `workbench`): Vite proxy 목적지를 `API_PROXY_TARGET` 으로 바꿀 수 있다(기본 `http://localhost:8080`)
- README 「백엔드와 나란히」: 작업 폴더에 `api` · `web` 으로 두고 백엔드 `scripts/dev.sh` 로 DB · 로컬 S3 · 백엔드 · 이 프론트를 한 번에 띄운다. `new-project.sh` 의 안내도 같다

### Added — Storybook: 스토리가 부품의 정본(보이는 모습 · 정본 사용법 · 실행되는 테스트)

- `apps/storybook`(Storybook 10 · `@storybook/react-vite` · Vite 8 에서 그대로 동작) — 설정 `.storybook/`(토큰 · `base.css` 로드, 도구 모음의 라이트/다크 스위치 = `<html data-theme>`, autodocs, a11y 위반이 실패인 `a11y: { test: 'error' }`), **Patterns** 6개(목록 · 폼 · 상세 · 로그인 · 403 · 설정 — `@skeleton/ui` 만으로 짠 복사용 한 파일 화면 틀, 도우미 파일 없음, 다크 변형 포함), 토큰 문서(`tokens.json` 에서 읽은 색 · 간격 · 모서리 · 글자 크기 · 그림자, 라이트 · 다크 나란히 — 쇼케이스의 토큰 페이지를 옮김)
- 스토리는 부품 옆(`packages/*/src/**/*.stories.tsx`, CSF3 · `satisfies Meta`): `@skeleton/ui` 의 모든 export(상태별 + `play` — 클릭 · 키보드 · 포커스 링 · 라벨/오류 연결 · 탭 화살표 · 다이얼로그 Esc 와 포커스 복귀 · 쪽 이동 끝), `theme` · `notifications` · `captcha-turnstile` · `auth`(`RequireAuth`) · `storage`(`useUpload`) · `time`. 가짜(받은편지함 · Turnstile · 인증 · 업로드 전송)는 각 패키지의 `src/stories/`(쇼케이스의 `fakes/` 를 옮김)
- 루트 스크립트 `storybook` · `storybook:build` · `test:stories`(진짜 브라우저 headless — Vitest 애드온 + Playwright chromium). `pnpm test` 는 그대로 빠른 단위 테스트. CI 에 `stories` 잡(브라우저 캐시 · 타임아웃)
- ESLint(`apps/**`): 날 `<button>` · `<input>` · `<select>` · `<textarea>` · `<dialog>` 와 인라인 style 의 색 · 간격 · 모서리 · 글자 크기 날값을 막고, 메시지가 대신 쓸 `@skeleton/ui` 부품을 말한다. `packages/ui` 와 다른 패키지는 제외, `apps/workbench` 는 명시적 예외(`UI_ONLY_EXEMPT`)
- 루트 테스트 `tests/stories.test.ts`(모든 `@skeleton/ui` export 에 스토리 + `play` · 모든 스토리가 CSF3 · 모든 Patterns 가 CLAUDE.md 안내에 적힘 + `@skeleton/ui` 만 import · `docs/ui-catalog.md` 일치) · `tests/eslint.uiOnly.test.ts`. 의존 규칙: 스토리(`*.stories.tsx` · `src/stories/`)는 테스트 쪽 파일로 세어 devDependencies · 루트 Storybook 도구로 충분
- `docs/ui-catalog.md`(부품 → 스토리 → 언제 쓰는가) · CLAUDE.md 의 「UI 를 만들기 전에」(스토리 먼저 · Patterns 에서 시작 · 날 요소/값 금지 · 부품을 바꾸면 스토리 + play)
- `scripts/new-project.sh`: 스토리집 · 남는 패키지의 스토리 · Patterns · 카탈로그 · 에이전트 안내 · CI 잡이 **기본으로 따라온다**, `--without-storybook` 이면 깨끗이 뗀다. `test-new-project.sh --full` 의 조합 2 가 `storybook:build` · `test:stories` 를 돈다

### Changed

- **`apps/showcase` 를 없앴다** — 부품 상태는 스토리로, 토큰 페이지는 `apps/storybook` 으로, 가짜는 각 패키지의 `src/stories/` 로 옮겼다(시간 포맷 표는 `time` 스토리로). api-client · payment · realtime 데모(컴포넌트가 없는 패키지)는 옮기지 않았다 — 각 패키지 README 가 있다. `pnpm dev:showcase` · `new-project.sh --with-showcase` 는 없어졌다(`--with-showcase` 는 안내와 함께 exit 2)
- `auth` · `captcha-turnstile` · `storage` · `theme` · `time` 이 스토리에서 `@skeleton/ui` 를 쓰므로 devDependency 로 선언하고(`auth` · `captcha-turnstile` · `storage` · `time` 은 tsconfig `types: ["vite/client"]` — ui 의 CSS Modules 타입), 루트 devDependencies 에 Storybook · `@vitest/browser-playwright`(vitest 와 같은 버전) · `playwright`
- 이름 `storybook` · `storybook-app` 은 앱 이름으로 예약

### Added — 서버 렌더 스타터 · 쇼케이스 · SSR 안전

- `apps/starter-ssr` — 서버가 첫 응답을 그리고 브라우저가 이어받는 스타터(plain Vite SSR: `server/` Node 서버 · `src/entry-server.tsx` · `src/entry-client.tsx`, 새 런타임 의존 없음). 홈(`GET /hello` 를 서버가 시간 제한 안에 가져와 TanStack Query `dehydrate`/`hydrate` 로 넘김 — 백엔드가 죽으면 데이터 없이 200) · 로그인 · 보호 `/account`(토큰은 브라우저에만 — 서버는 중립 자리 표시, `createDeferredTokens`) · 404(실제 상태 코드), 라우트별 `<title>` · 설명(`handle`), 테마 스크립트가 `<head>` 맨 앞. `pnpm --filter starter-ssr dev|build|start`, Dockerfile(런타임에 node_modules 없음). 테스트: 서버 렌더 · 하이드레이션 마크업 일치 · 핸들러 · 빌드한 서버를 띄우는 통합 테스트
- `apps/showcase` — (이후 Storybook 으로 대체되어 없어졌다 — 위 Unreleased 참고)
- `scripts/new-project.sh --ssr`(`apps/starter-ssr` 를 앱으로) · `--with-showcase`(`apps/showcase` 유지). `scripts/test-new-project.sh --full` 에 `--ssr --with-showcase` 조합 추가
- 루트 테스트 `tests/ssr.safety.test.ts` — 모든 패키지 entry 가 브라우저 전역 없는 Node 에서 import 되고(import 시점에 아무것도 건드리지 않음), export 한 모든 컴포넌트 · 훅이 서버에서 경고 없이 그려진다(목록은 `exports` 에서 만들어 새 export 를 잊을 수 없다)
- `@skeleton/theme`: `initTheme()` · `getServerTheme()`
- `@skeleton/tokens`: 테마 속성이 `<html>` 만이 아니라 아무 요소에서나 동작(`:root, [data-theme='light']` · `[data-theme='dark']`) — 라이트 · 다크를 나란히 보일 수 있다

### Changed (SSR 안전)

- **`@skeleton/theme` 는 import 시점에 저장소를 읽거나 `<html>` 을 건드리지 않는다.** 앱 진입점이 `initTheme()` 을 불러야 한다(`apps/starter` · `apps/workbench` 는 이미 부른다; 루트 테스트가 확인). `useTheme` 의 서버 스냅샷은 항상 `system`(하이드레이션 일치)
- 루트 devDependencies 에 `react` `react-dom` `react-router-dom` `@tanstack/react-query`(SSR 안전 테스트용)
- `tokens.css` 의 `html[data-theme='dark']` 셀렉터가 `[data-theme='dark']` 로 — `pnpm tokens` 로 다시 생성

### Added — 프론트 조각 보강 · 프로젝트 찍기

- **새 패키지 4개** (각자 `package.json` · 테스트 · README, 서로는 이름으로만):
  - `@skeleton/notifications` — 받은편지함 클라이언트(`GET /notifications` 페이지 · `PATCH …/{eventId}/read` · `PATCH …/read-all`, 경로는 `basePath`) · TanStack Query 훅 · 안 읽은 수(= `unreadOnly&size=1` 의 `totalElements`) · `useNotificationIngest` 로 `@skeleton/realtime` 이벤트를 캐시에 반영(중복 id 한 번만) · `NotificationBell`/`NotificationList`
  - `@skeleton/storage` — 프리사인 업로드: 클라이언트 검증(백엔드 `StorageFileValidator` 와 같은 규칙 · 코드) → presign → XHR 직접 PUT(진행률 · 취소) → 키(+ 공개 주소), 큰 파일 멀티파트(조각 presign · 동시성 · ETag · 실패/취소 시 abort) · `useUpload`. 백엔드 모듈이 HTTP 를 열지 않아 경로는 `endpoints` 로 받는다(기본 경로 없음)
  - `@skeleton/payment` — `PaymentContracts` 타입 · `createPaymentApi`(준 경로만) · `confirmRequestFromTossRedirect` · `isPaymentError`. 모듈 계약이 얇아 결제 흐름은 만들지 않았다(README 에 한계)
  - `@skeleton/captcha-turnstile` — `loadTurnstile`(한 번만 · 재시도) · `<Turnstile>` · `useTurnstileToken` · `attachTurnstileToken`(`cf-turnstile-response`)
- `@skeleton/auth`: 소셜 로그인 도우미 — `buildAuthorizeUrl`(google · kakao · naver 프리셋) · `createSocialLoginFlow`(state 보관 · 검증 · 한 번만 → `socialLogin(provider, code, redirectUri)`) · `parseSocialCallback` · `useSocialLoginCallback`
- `@skeleton/ui`: `Textarea` `Checkbox` `Switch` `Tabs`(WAI-ARIA · roving tabindex · 화살표/Home/End) `Table` `Pagination`(0 기반 `PaginationMeta`) `EmptyState` · `toastPromise`(로딩 → 성공/실패가 한 토스트에서)
- `@skeleton/tokens`: 간격(`--space-xs…3xl`) · 모서리(`--radius-sm…full`) · 글자 크기/줄 높이(`--font-size-caption…title` · `--line-height-*`) 토큰(원시 → 의미) + 테스트 도구 `findRawLayout`
- `scripts/new-project.sh <target-dir> <name> [--packages a,b,c] [--with-workbench] [--scope @acme]` — 복사 → 필요한 패키지만(스타터가 쓰는 것 + `--packages` 의 의존 닫힘) → `apps/starter` 를 `apps/<name>` 으로 → 루트 `package.json` · eslint · 문서 → (선택) 스코프 바꾸기. `scripts/test-new-project.sh --quick`(`pnpm test` 가 부름) · `--full`(세 조합을 찍어 install · lint · typecheck · test · build — `.github/workflows/new-project.yml`)
- `apps/workbench`: `/packages` 예제 화면(`src/modules/demos`) · `apps/starter` 404 페이지는 `EmptyState`
- 루트 테스트: 간격 · 모서리 · 글자 크기 날값 금지(`tests/usage.test.ts`), 이 레포의 앱 · 패키지 목록은 `tests/skeleton.repo.test.ts` 로 분리(찍을 때 지워진다) — 일반 규칙(`workspace` · `usage` · `contrast`)은 이름을 하드코딩하지 않는다

### Changed

- `@skeleton/ui` · `theme` · starter 의 CSS 는 간격 · 모서리 · 글자 크기에 토큰만 쓴다. 4px 격자에 없던 6 · 10 · 14px 은 가까운 단계로 맞췄다(안쪽 여백이 최대 2px 달라짐), 제목 `line-height` 1.15 · 1.2 · 1.25 → 1.2(`tight`), `code` · `pre` 1.35 · 1.45 → 1.35(`snug`). 예외: `apps/workbench` CSS(토큰으로 옮기려면 540줄 — `tests/support/layoutExempt.ts` 가 명시한다)
- 루트 `pnpm test` 가 `scripts/test-new-project.sh --quick` 도 돈다

### Migration — 단일 Vite 앱 → pnpm 워크스페이스 (앱 2 + 패키지 7)

기존 프로젝트(이 스켈레톤에서 시작한 레포)가 이 변경을 가져올 때의 옮김표. 백엔드 `modules/` 처럼 프로젝트가 필요한 패키지만 한 줄(`"@skeleton/<이름>": "workspace:*"`)로 골라 쓴다.

| 예전 위치                                                                           | 지금 위치                                                                                                                                                                            |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 앱 전체(`src/` · `index.html` · `vite.config.ts` · `public/`)                       | `apps/workbench/`(데모 그대로) · `apps/starter/`(복사해 가는 출발점)                                                                                                                 |
| `src/api/{types,errorCodes,traceContext}.ts` · `src/modules/http/*`                 | `@skeleton/api-client` — `createSkeletonHttpClient({ baseURL })` → `createApiClient({ baseUrl })`                                                                                    |
| `src/api/client.ts`(`api` · `apiList` … 전역 함수 + `import.meta.env`)              | 앱의 `src/api/` (패키지는 `import.meta.env` 도 싱글턴도 없다). 환경변수는 `apiConfigFromEnv(import.meta.env)`                                                                        |
| `accessToken` · `devLogin` · `breakGlass` 요청 옵션                                 | `headers` + `@skeleton/auth` 의 `requestAuthHeaders(...)` / `getAuthHeaders` · `skipAuth`. (워크벤치는 요청 옵션 그대로 받는 얇은 어댑터를 `apps/workbench/src/api/client.ts` 에 둠) |
| `src/modules/auth/authSession.ts`                                                   | `@skeleton/auth`(`parseDevIdentity` · `applyAuthHeaders` · `decodeTokenPrincipal` 그대로)                                                                                            |
| `src/modules/notifications/*` + HomePage 안의 SSE/STOMP 코드                        | `@skeleton/realtime`                                                                                                                                                                 |
| `src/lib/time/*`                                                                    | `@skeleton/time`                                                                                                                                                                     |
| `src/lib/theme.ts` · `ThemeToggle` · `ThemedToaster` · `index.html` 인라인 스크립트 | `@skeleton/theme`(스크립트는 `@skeleton/theme/vite` 의 `themePrePaint()` 플러그인이 `<head>` 에 넣는다)                                                                              |
| `design/tokens/*` · `src/styles/tokens.css`                                         | `packages/tokens/{tokens.json,build.mjs,tokens.css}` — `pnpm tokens` · `pnpm tokens:check` 는 루트에서 그대로                                                                        |
| `src/index.css`                                                                     | `@skeleton/ui/base.css`(리셋 + 요소 타이포) + `apps/workbench/src/workbench.css`(워크벤치 전용)                                                                                      |
| `src/components/ErrorBoundary.tsx` · `src/lib/showApiError.tsx`                     | `@skeleton/ui` — 문구는 prop(기본 영어). 워크벤치는 한국어 문구를 넘긴다                                                                                                             |
| `src/styles/{contrast,usage}.test.ts` · `src/test/*`                                | 루트 `tests/` (두 앱 + 모든 패키지를 훑음) · 도구는 `@skeleton/tokens`                                                                                                               |
| `.env` · `.env.example`                                                             | 각 앱 폴더(`apps/*/.env`) — Vite 가 앱 폴더에서 읽는다                                                                                                                               |

- 루트 명령은 그대로: `pnpm lint` · `tokens:check` · `typecheck` · `test` · `format:check` · `build`(이제 워크스페이스 전체). 새로: `pnpm dev`(= starter) · `pnpm dev:workbench`.
- CI 의 Node 를 24 로(`vite.config.ts` 가 `@skeleton/theme/vite` 의 `.ts` 를 Node 로 직접 읽는다 — 22.18+ 도 가능).

### Added

- `pnpm-workspace.yaml`(`apps/*` · `packages/*`) · `tsconfig.base.json` · 단일 `eslint.config.js`(경계 규칙: `@skeleton/*/src/**` 딥 임포트 금지, 패키지/앱이 앱 코드 import 금지)
- 패키지 7개(`@skeleton/api-client` `auth` `realtime` `time` `theme` `tokens` `ui`) — 각자 `package.json`(`exports` = `src/index.ts`, 소스 수준 해석, 빌드 단계 없음) · 옆 테스트 · `README.md`
- `@skeleton/api-client`: `createApiClient(config)`(baseUrl · timeoutMs · retry · `getAuthHeaders` · `getTimeZone` · `onResponseDate`(서버 시각 연결점) · `onError` · `debug`), `apiConfigFromEnv`, 요청 옵션 `skipAuth`
- `@skeleton/auth`: 토큰 저장소(메모리 + 주입하는 storage) · `createAuthApi`(`login` · `me` · `socialLogin(provider, authorizationCode, redirectUri)` — 백엔드 `/auth/login` · `/auth/me` · `/auth/social/{provider}/login`) · `createAuthSession` · `AuthProvider`/`useAuth` · `<RequireAuth>` · dev-login/break-glass 헤더 helper · `createAuthHeadersProvider` · `createUnauthorizedHandler`(401 연결점)
- `@skeleton/realtime`: `createSseClient`(fetch streaming) · `createStompNotificationClient`(WebSocket + STOMP 프레임, 재연결 정책) · `useSseClient` · `useNotificationSocket`
- `@skeleton/ui`: `Button` `Input` `Field` `Select` `Card` `Dialog` `Spinner` `AppShell`(CSS Modules, 의미 토큰만, 문구는 prop)
- `@skeleton/tokens`: 출력 경로가 옵션(`build({ root, source, cssOut, docOut })` · `--source` `--css` `--doc`), 문서 표 생성은 `docOut` 을 줄 때만
- `apps/starter`: 라우터(홈 · 로그인 · `RequireAuth` 아래 `/account` · 404) · `AppShell` + `ThemeToggle` · `VITE_*` 환경변수 배선 · `QueryClient` + 에러 토스트 · `GET /hello` 예시 훅
- 루트 `tests/`: 선언한 `@skeleton/*` 의존 = 소스 import(= 패키지를 지울 수 있다) · `starter` 가 워크벤치에 의존하지 않음 · 외부 import 선언 · 패키지의 `import.meta.env` 금지 · ESLint 경계 규칙 · 토큰 사용 검사가 두 앱 + 모든 패키지를 덮음
- 모든 앱 · 패키지에 `typecheck` 스크립트(루트 `pnpm typecheck` 가 전부 돈다)

### Changed

- 워크벤치의 SSE/WebSocket 연결을 `@skeleton/realtime` 훅으로 교체(UI · 호출 엔드포인트 동일). 화면 로그 변환은 `apps/workbench/src/modules/workbench/realtimeExchanges.ts` 로 분리(테스트 추가)
- 패키지 tsconfig 는 `types: []` — 패키지에서 `import.meta.env` 를 쓰면 타입 에러

### Fixed

- SSE · WebSocket 시작 버튼이 클릭 이벤트를 `attempt` 인자로 받던 문제: 수동 시작 때 이벤트 목록이 비워지지 않고, 첫 재연결 지연이 `NaN`(즉시)이던 것을 설계대로(목록 비움 · 1s 지수 백오프)로. 상태는 바뀔 때만 보고
- `createQueryClient`(starter): 캐시 `onError` 가 넘기는 추가 인자(query · mutation …)가 토스트 핸들러로 새지 않게 에러만 전달

> 아래 `Changed` · `Added` · `Fixed` 는 워크스페이스 전환 이전부터 쌓여 있던 Unreleased 항목이다.

### Changed

- `ApiError` 타입을 백엔드 `ApiError` 와 1:1 로 맞춤: `type` 제거, `code` 추가, `data` 추가, `detail`/`traceId`/`spanId`/`errors`/`FieldError.message` 는 `?: T | null`. `AuthPrincipal.username`/`email` 도 백엔드처럼 nullable(`decodeTokenPrincipal` 는 빠진 claim 을 `'-'` 대신 `null` 로 돌려줌)
- 응답을 못 해석한 4xx/5xx 는 `CLIENT.HTTP_ERROR`, 네트워크 실패는 `CLIENT.NETWORK_ERROR` 코드로 `ApiRequestError` 가 됨. body 에 `code` 가 없으면 ApiError 로 보지 않고 `CLIENT.HTTP_ERROR` 로 처리
- `pnpm typecheck` 가 `tsc -b --noEmit` 으로 app + node 설정을 실제로 검사(전엔 `files: []` 라 아무것도 검사하지 않음). CI 가 lint · tokens:check · typecheck · test · format:check · build 를 실행
- `newIdempotencyKey()` 를 `modules/workbench/workbenchUtils` 에서 `modules/http/idempotencyKey` 로 이동(워크벤치 import 는 re-export 로 유지)
- `package.json` version 을 CHANGELOG/태그에 맞춰 1.1.0 으로

### Added

- `src/api/errorCodes.ts`: 백엔드 Kotlin 에 정의된 에러 코드 상수 `ErrorCodes`(Platform · Auth · AuthSocial · Payment), 클라이언트 합성 코드 `ClientErrorCodes`, 분기 헬퍼 `isErrorCode(error, code | codes[])`
- HTTP 클라이언트 4xx/5xx · 전송 실패 경로 테스트, `isErrorCode` · `newIdempotencyKey` · nullable principal 테스트

### Fixed

- `pnpm format:check` 실패 4개 파일 포맷(동작 변경 없음)
- CLAUDE.md(`client.ts` 는 axios · `hooks/` 없음 · `modules/` 누락) 와 README 템플릿 명령(`turong92/react-skeleton`) 을 실제와 맞춤

### Added

- 디자인 토큰 메커니즘 + 라이트/다크 테마: `design/tokens/tokens.json`(W3C Design Tokens 형식, `$extensions.skeleton`) → `design/tokens/build.mjs`(의존성 없음) → `src/styles/tokens.css` + `docs/design-tokens.md` 표 구역. 층은 원시 `--p-*` → 의미(`--bg`, `--text`, …) 둘. `pnpm tokens`(쓰기) · `pnpm tokens:check`(비교, 어긋나면 1, CI 에 추가). 테마는 `<html data-theme="light|dark">`, 없거나 `system` 이면 `prefers-color-scheme` 을 CSS 만으로 따름(`color-scheme` 포함)
- `src/lib/theme.ts`(`getTheme`/`setTheme`/`useTheme`, localStorage 저장 · 막혀도 동작) + 헤더 `ThemeToggle`(system → light → dark) + `index.html` 인라인 스크립트(첫 칠 전 적용) + sonner 토스트 테마 연동
- 테스트: 생성물 일치 · 날 색 금지(CSS · 인라인 style) · `--p-*` 직접 사용 금지 · `var()` 정의 확인 · 두 테마 WCAG AA 글자/바탕 짝 · 생성기 CLI(`--check` 어긋남 1, 모르는 인자 2)
- `docs/design-tokens.md`(층 · 이름 · 토큰/테마/부품 층 추가법), `design/README.md`

### Changed

- `src/index.css` 의 `:root` 색 · 그림자 · 서체 변수 18개를 `tokens.json` 으로 옮김(이름 그대로, 라이트 화면 변화 없음). `index.css` · `ErrorBoundary` 의 날 색(`#fff`, `#17201c`, `#fbfcfb`, `rgba(...)` 등)을 토큰으로 교체(`--inverse`/`--on-inverse`, `--surface-alt`, `--surface-sunken`, `--header-bg`, `--teal-wash`, `--red-border` 신설)
- `--amber` `#a86612` → `#975c0f`: 옛 값은 `--amber-soft` · `--code-bg` 위에서 AA 4.5:1 미달(4.08 · 3.84)이라 한 단계 어둡게
- `.prettierignore` 에 생성물(`src/styles/tokens.css`, `docs/design-tokens.md`) 추가

- `src/lib/time`: 글로벌 시간 처리 (백엔드 `modules:time` 짝) — `formatInstant`/`formatDate`(변환 없음)/`formatDual`(이벤트+내 시간대, `GMT+9` 표기)/`formatRelative`/`toZonedMoment`(DST 틈·중복 정책 백엔드와 동일)/`zoneLabel`, `createServerClock`(응답 `Date` 헤더로 서버 시각 보정), `defaultZoneOf`/`zonesOf`(국가→시간대, 생성 파일). `Intl` 만 사용. 테스트 9개
- API 클라이언트가 요청마다 `X-Time-Zone`(기기 시간대) 헤더를 붙이고 응답 `Date` 헤더로 `serverClock` 을 보정
- `ErrorBoundary`: 렌더링 에러를 fallback UI로 격리
- `VITE_API_BASE_URL` support in the shared API client for direct backend/CORS verification.
- Standard REST response DTO helpers: `apiValue`, `apiList`, `apiPage`, and `apiEnvelope`.
- `sonner` 기반 전역 API 에러 토스트: `ApiRequestError`의 `traceId`를 표시하고 클릭 복사 지원
- W3C `traceparent` 생성/전파: `traceId`는 전체 플로우, `spanId`는 개별 요청 단계로 사용
- 콘솔/토스트에 `traceId`, `spanId`, `traceparent` 디버깅 정보 출력

## [1.1.0] - 2026-04-20

### Added

- **React Router v7** 도입: `src/routes/` 에 페이지, `src/layouts/RootLayout.tsx` 에 공통 레이아웃
- **TanStack Query DevTools** (dev 모드에서만 로드)
- **api/client.ts 강화**: 요청마다 UUID 기반 `X-Request-Id` 헤더 자동 부착, 에러 응답의 `ApiError` 파싱, 개발 모드 콘솔 그룹 로그 (traceId 포함)
- **api/types.ts**: `ApiError`, `ApiRequestError` — 백엔드 `ApiError`와 1:1 매칭
- **디렉토리 구조**: `src/api/`, `src/routes/`, `src/layouts/`, `src/components/`, `src/hooks/`, `src/lib/` 경계 CLAUDE.md에 명시

### Changed

- `src/App.tsx` 제거 → 라우트 기반 구조로 전환 (`HomePage`, `NotFoundPage`)
- `main.tsx` 가 `QueryClientProvider` + `RouterProvider` + `ReactQueryDevtools` 조합으로 재구성

## [1.0.0] - 2026-04-20

### Added

- Vite + React 19 + TypeScript (strict) 기본 구성
- TanStack Query 5 프로바이더 세팅 (`src/main.tsx`)
- 공통 fetch 래퍼 `src/api/client.ts` (baseURL `/api/v1`)
- Vite dev proxy → `http://localhost:8080/api/v1`
- ESLint + Prettier 설정
- GitHub Actions CI 워크플로 (lint + typecheck + build)
