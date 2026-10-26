# @skeleton/dashboard

관리자 대시보드 한 벌 — 서버가 모아 준 숫자(우리 DB · Cloudflare · GA)를 한 화면에 그린다. 차트 라이브러리 없이 SVG 로 직접(선 · 퍼널 막대). 백엔드 `modules/dashboard`(+ `dashboard-jdbc` · `dashboard-cloudflare` · `dashboard-ga`) 짝, 모두 `dashboard.read` 권한.

```tsx
const api = createDashboardApi(apiClient) // 기본 경로 /admin/dashboard
<DashboardView api={api} zone="Asia/Seoul" locale="ko-KR" labels={koDashboardLabels} />
```

`QueryClientProvider` 아래에서 쓴다. 기간(오늘 · 7일 · 30일 · 직접) · 직전 기간 비교 · 타일 선택은 `DashboardView` 가 쥔다. 개요는 60초마다 다시 받고 탭이 숨으면 멈춘다.

| 내보내기                                                                                        | 하는 일                                                                                                                                          |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `createDashboardApi(client, { basePath })`                                                      | `overview` · `ranking` · `realtime` · `layout` · `saveLayout`                                                                                    |
| `useDashboard(api, span, compare)` · `useRanking(api, key, span)`                               | TanStack Query 훅(60초 갱신)                                                                                                                     |
| `DashboardView`                                                                                 | 헤더 → 타일 + 그래프 → 순위 카드 → 퍼널 → 앱 통계. `headerTrailing`(지금 N명 · 편집 단추 자리) · `renderLink`(타일의 `link` 를 라우터 `Link` 로) |
| `MetricTiles` · `MetricChart` · `RankingCard` · `FunnelBars` · `TrendChart` · `DashboardHeader` | 부품 — 화면을 다시 짤 때                                                                                                                         |
| `spanOf` · `deltaOf` · `formatValue`                                                            | 기간 → 조회 날짜 · 증감 · 단위별 글자                                                                                                            |
| `defaultDashboardLabels` · `koDashboardLabels`                                                  | 문구(영어 기본). 서버가 주는 지표 · 순위 · 열 이름은 `labels.metrics` · `rankings` · `columns` 맵에 키가 있으면 그것으로                         |

## API (계약 C1)

| 호출                              | 경로                                                                                     |
| --------------------------------- | ---------------------------------------------------------------------------------------- |
| `overview(span, compare)`         | `GET /admin/dashboard?from&to&compare`                                                   |
| `ranking(key, span, limit = 100)` | `GET /admin/dashboard/rankings/{key}` (전체 보기, limit ≤ 500)                           |
| `realtime()`                      | `GET /admin/dashboard/realtime` (없으면 404)                                             |
| `layout()` · `saveLayout(layout)` | `GET` · `PUT /admin/dashboard/layout` (저장소 없으면 404 `DASHBOARD.LAYOUT_UNAVAILABLE`) |

- 날짜는 대시보드 시간대의 `YYYY-MM-DD`(양 끝 포함). 7일 · 30일은 오늘을 끝으로 센다.
- 출처 상태: `OK` 외(`NOT_CONNECTED` · `NO_HISTORY` · `ERROR`)는 그 타일 · 탭만 안내로 바뀐다. 직전 값이 없는 지표(활성 이용자)는 「비교 불가」.
- 돈은 통화의 최소 단위 정수, `PERCENT` 는 100분의 1 퍼센트로 가정(`format.ts`).
- **편집 모드**: 헤더 「편집」 → 타일 · 카드를 스위치로 끄고, 카드는 ▲▼(폰에서도) 또는 끌어서(넓은 화면) 순서를 바꾸고, 「완료」로 저장한다(`useDashboardLayout`). 서버(`GET/PUT /admin/dashboard/layout`, 계정별)에 저장하고, 저장소가 없으면(404 `DASHBOARD.LAYOUT_UNAVAILABLE`) 브라우저 `localStorage` 에 둔다 - `layoutKey`(보통 계정 id)가 키에 들어간다. 저장 모양 `{ hidden: [타일 키 · 카드 키], order: ['tiles', 'chart', 'rankings.traffic', …, 'funnel', 'app'] }`.
- 앱 통계: 묶음 `app` 의 순위는 `AppStatsCard`(「앱이 붙임」 배지)로 그려진다.
- 스토리: `DashboardView.stories.tsx`(정본 사용법 + 키 없음 · 로딩 · 실패 · 폰 너비).
