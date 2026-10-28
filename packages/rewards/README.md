# @skeleton/rewards

보상 사용자 화면 한 벌 — 출석 · 친구초대 · 쿠폰함 · 결제 때 쿠폰 고르기 · 포인트 잔액과 내역. 백엔드 `modules/campaign` · `coupon` · `point`(+ `*-jdbc`, 지급 일꾼 `reward`)의 사용자 HTTP 짝이고, **붙인 갈래만 쓴다**(서브경로 `@skeleton/rewards/campaign` · `/coupon` · `/point` 로도 가져온다). 운영 화면은 선택 하위 경로 `@skeleton/rewards/admin`(아래).

```tsx
const api = createRewardsApi(apiClient) // 기본 경로 /campaigns · /referrals · /coupons · /points
<AttendanceCard api={api} campaignId={attendance.id} labels={koRewardsLabels} />
<CouponWallet api={api} labels={koRewardsLabels} />
<PointBalance api={api} labels={koRewardsLabels} />
```

`QueryClientProvider` 아래에서 쓴다. 문구는 `labels`(영어 기본, `koRewardsLabels`), 일부만 바꾸려면 `resolveRewardsLabels({ … })`.

| 내보내기                                                                                            | 하는 일                                                                                                                               |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `createRewardsApi(client, paths?)` (`createCampaignApi` · `createCouponApi` · `createPointApi`)     | 호출 모음. 일부 모듈만 붙였으면 그 갈래의 `create…Api` 만 써도 된다                                                                   |
| `useCampaigns` · `useAttendance(api, id)` · `useAttendanceMonth(api, id, '2026-10')` · `useCheckIn` | 이벤트 목록 · 출석 이벤트 하나 · 출석한 날 · 출석(성공하면 보상이 들어왔을 수 있어 `['rewards']` 전부 무효화)                         |
| `useReferral` · `useClaimReferral`                                                                  | 내 초대 코드와 현황 · 코드로 가입                                                                                                     |
| `useReferralCapture({ storage, signedIn, claim, onClaimed, onRejected })`                           | 초대 링크 `?ref=` 를 30일 보관 → 로그인한 뒤 claim 한 번 → 지움(400 · 409 도 지움, 서버에 못 닿았으면 남김). 가입 화면 근처에서 한 번 |
| `useCoupons(api, 'AVAILABLE' \| 'PAST')` · `useRedeemCoupon`                                        | 쿠폰함 · 코드 등록                                                                                                                    |
| `usePoints` · `usePointHistory`                                                                     | 잔액(곧 소멸) · 내역(커서)                                                                                                            |
| `AttendanceCard` · `InviteCard`                                                                     | 출석 카드(「출석하기」 → 「오늘 출석함」) · 내 코드 + 복사                                                                            |
| `CouponWallet` (`RedeemCodeForm` · `CouponCard`)                                                    | 코드 등록 + 「사용 가능 / 사용·만료」 탭                                                                                              |
| `CouponPicker { coupons, selectedId, onSelect, preview? }`                                          | 결제 때 쿠폰 하나 고르기 + 할인 전 → 후 금액                                                                                          |
| `stageSummary(stages, labels.coupon, { currency })`                                                 | 혜택 단계 → 「첫 1회 무료, 이후 3회 50%」 · 「매번 10%」                                                                              |
| `PointBalance` · `PointHistory`                                                                     | 잔액 한 칸 · 내역 목록                                                                                                                |

## API (계약 C-R)

| 호출                                      | 경로                                                                                                     |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `listCampaigns()`                         | `GET /campaigns` — 진행 중 이벤트 + 내 상태(출석: `checkedToday` · `total` · `streak` · `nextMilestone`) |
| `checkIn(id)`                             | `POST /campaigns/{id}/attendance` — 끝난 · 꺼진 이벤트 409 `CAMPAIGN.NOT_ACTIVE`                         |
| `attendanceMonth(id, month)`              | `GET /campaigns/{id}/attendance?month=2026-10`                                                           |
| `myReferral()` · `claimReferral(code)`    | `GET /referrals/me` · `POST /referrals/claim {code}` (204 · 400 `CAMPAIGN.REFERRAL_INVALID`)             |
| `listCoupons(tab)` · `redeemCoupon(code)` | `GET /coupons?status=AVAILABLE\|PAST` · `POST /coupons/redeem {code}` (400/409 `COUPON.CODE_*`)          |
| `points()` · `pointHistory(cursor?)`      | `GET /points` · `GET /points/history?cursor`                                                             |

- **결제와 잇기**: 이 패키지는 `@skeleton/payment` 를 import 하지 않는다. 앱이 `CouponPicker` 의 `selectedId` 를 견적·주문 요청의 `discounts: [{ type: 'coupon', ref }]` 에 싣고, 견적 응답을 `preview`(`{ originalAmount, amount, currency }`)로 옮겨 준다.
- 포인트를 **쓰는** 길은 HTTP 가 없다(서버 API `PointWallet.spend`) — 읽기만 있다.
- 쿠폰의 적용 범위(`scope`)는 카드에 그리지 않는다 — 어느 쿠폰이 이 결제에 맞는지는 서버(`PAYMENT.DISCOUNT_NOT_APPLICABLE`)가 판정한다.
- 스토리: `AttendanceCard` · `InviteCard` · `CouponWallet`(코드 등록 · 잘못된 코드) · `CouponPicker` · `PointBalance` · `PointHistory`, 가짜 API 는 `src/stories/fakeRewards.ts`.

## 운영 화면 — `@skeleton/rewards/admin`

각 모듈의 `skeleton.<module>.admin.enabled=true`(기본 꺼짐 → 404)와 권한이 있어야 열린다. 권한은 기본 역할이 없다 — 전권이거나 역할 화면에서 준 계정만. 단추는 `can(key)` prop 으로 숨긴다(검사는 서버, 패키지는 `@skeleton/auth` 를 import 하지 않는다).

| 내보내기                                             | 권한              | 하는 일                                                                                                                                                                                                                                                                                                                                                                                        |
| ---------------------------------------------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `createRewardsAdminApi(client, { basePath })`        |                   | `GET/POST /admin/campaigns` · `PUT /{id}` · `PATCH /{id}/enabled` · `GET/POST /admin/coupon-definitions` · `PATCH /{id}/status` · `POST /{id}/issue {accountIds}` · `POST /{id}/codes` · `GET /admin/coupons?accountId` · `POST /admin/coupons/{id}/revoke` · `GET /admin/points/{accountId}` · `POST …/adjustments` · `GET /admin/reward-grants?status` · `POST /{id}/retry` · `/{id}/cancel` |
| `AdminCampaigns`                                     | `campaign.manage` | 목록 · 켜고 끄는 스위치 · 만들기/고치기(출석: 매일 보상 + 달성 보상, 초대: 두 쪽 보상 · 시점 · 새 계정 일수 · 상한)                                                                                                                                                                                                                                                                            |
| `AdminCouponDefinitions`                             | `coupon.manage`   | 정의 목록 · 만들기(`StageEditor`) · 상태 · 계정에 주기 · 공용 코드 · 한 계정의 쿠폰 회수                                                                                                                                                                                                                                                                                                       |
| `StageEditor`                                        |                   | 혜택 단계(무료 · 정률 · 정액 × 횟수/영원). 단계 다섯까지, 영원은 마지막만, 「무료 이용권」 · 「n달 무료」 틀                                                                                                                                                                                                                                                                                   |
| `AdminPoints`                                        | `point.manage`    | 계정 찾기 · 잔액 · 내역 · 사유와 함께 조정(`POINT.INSUFFICIENT` 는 문장)                                                                                                                                                                                                                                                                                                                       |
| `AdminRewardGrants`                                  | `reward.operate`  | 상태 걸러 보기 · 「다시 지급」(FAILED) · 「멈추기」(PENDING)                                                                                                                                                                                                                                                                                                                                   |
| `koRewardsAdminLabels` · `defaultRewardsAdminLabels` |                   | 문구(영어 기본)                                                                                                                                                                                                                                                                                                                                                                                |

- 계약 C-ADM 에서 본문이 정해지지 않은 두 곳은 이렇게 가정했다: `GET /admin/points/{accountId}` → `{ balance, entries[] }`, `POST /admin/coupon-definitions/{id}/codes` → `{ code }`. 서버가 다르면 `admin/types.ts` 의 `AdminPointAccount` · `CouponCode` 를 맞춘다.
- 스토리: `src/admin/*.stories.tsx`, 가짜 운영 API 는 `src/stories/fakeAdmin.ts`.
