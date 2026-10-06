# @skeleton/legal

백엔드 `modules/legal`(kotlin-skeleton `docs/legal-http-contract.md`)의 프런트 짝 — 법적 문서 읽기 · 가입 동의 · 첫 로그인 동의 · 새 판 재동의 · 동의 설정.

문서가 정적 파일이고 백엔드가 없는 사이트는 `@skeleton/marketing` 의 `LegalDocumentPage` 를 그대로 쓴다. 이 패키지는 **서버가 문서와 동의 기록을 쥘 때** 쓴다.

## 왜 따로 패키지인가

- `@skeleton/marketing` 은 백엔드 없는 공개 화면이라 `api-client` 도 TanStack Query 도 모른다 — 여기에 서버 호출을 넣으면 그 성질이 깨진다.
- `@skeleton/auth` 는 법적 문서를 모른다 — 가입 화면은 **슬롯**(`renderConsents`)만 열어 두고, 이 패키지가 거기 꽂힌다. 재동의 403 은 `api-client` 의 `recoverForbidden` 에 꽂힌다.
- 백엔드의 `legal` · `legal-jdbc` 모듈과 1:1 — 스타터는 둘 다 켜고(재동의 필터 포함) 프런트 스타터도 이 패키지를 켠다.

## API

| 이름                                                                                                          | 하는 일                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `createLegalApi(client, { basePath? })`                                                                       | `documents()` · `document(type, {version, locale})` · `myConsents()` · `agree(consents, source)` · `withdraw(type)` · `history({page,size})`              |
| `useLegalDocuments` · `useLegalDocument` · `useMyConsents` · `useAgree` · `useWithdraw` · `useConsentHistory` | TanStack Query 훅(문서는 5분 캐시)                                                                                                                        |
| `ConsentChecklist`                                                                                            | 필수/선택 줄 + 전체 동의(mixed) + 줄마다 「보기」                                                                                                         |
| `SignUpConsents`                                                                                              | 가입 폼 슬롯 — 서버 목록으로 체크박스, 체크한 `{종류, 판, 언어}` 를 슬롯으로. 404(모듈 없음)면 아무것도 안 그리고 가입을 막지 않는다                      |
| `DocumentDialog` · `LegalDocumentView` · `ApiLegalDocumentPage`                                               | 문서(마크다운은 `MarkdownView`, 날 HTML 없음) · 판 · 효력일 · 옛 판/예정 판/샘플/다른 언어 안내                                                           |
| `createReconsentController` + `ReconsentGate` · `ReconsentScreen`                                             | 403 `LEGAL.RECONSENT_REQUIRED` 와 로그인 직후 `blocked` 를 한 화면으로. 동의가 끝나면 막혔던 호출을 **그대로 한 번 더** 보낸다(로그아웃 · 토큰 갱신 없음) |
| `ConsentSettings`                                                                                             | 설정 절 — 상태 · 동의한 판 · 보기 · 선택 동의 켜고 끄기(철회) · 이력                                                                                      |
| `koLegalLabels` · `defaultLegalLabels`                                                                        | 문구(모두 prop)                                                                                                                                           |

## 붙이는 법

```ts
// api/client.ts — 403 재동의를 api-client 계층에서 받는다
const legalApi = createLegalApi(client)           // client 는 아래 controller 를 쓰므로 한 단계 늦게 연결한다(앱의 api/legal.ts 참고)
export const reconsent = createReconsentController({ api: legalApi })
createApiClient({ ..., recoverForbidden: reconsent.recover })
```

```tsx
// main.tsx — QueryClientProvider 안
;<ReconsentGate
  controller={reconsent}
  api={legalApi}
  accountId={principal?.accountId ?? null}
  onLeave={logout}
  locale={locale}
>
  <RouterProvider router={router} />
</ReconsentGate>

// 가입 라우트
signUp: {
  renderConsents: (slot) => <SignUpConsents api={legalApi} slot={slot} locale={locale} />
}
```

- **제외 경로**: 서버는 `/legal/**` · `/auth/**` · `/account/**` 를 막지 않는다(계약 4절) — 컨트롤러도 이 경로의 403 은 풀려 하지 않는다(`excludedPrefixes`).
- **첫 로그인(소셜 · 링크)**: 로그인한 계정 id 가 생기면 `ReconsentGate` 가 `GET /consents/me` 를 한 번 부르고 `blocked` 면 같은 화면을 연다(`source: first-sign-in`).
- **판 고르기**: 서버에는 판 목록 엔드포인트가 없다(현재 판 · `next` 뿐). 판 고르기는 현재 판 + 앱이 아는 판(`extraVersions` — 예: 내가 동의한 판)이다.
- **언어**: `GET /documents` 는 (종류, 언어)마다 한 줄이고 기본 언어는 알려 주지 않는다 — 사용자 언어 → `fallbackLocale` → 첫 줄 순으로 고른다.

## 쓰지 않는 경우

- 백엔드가 없거나 `legal` 모듈이 없다 → `@skeleton/marketing` 의 정적 문서.
- 쿠키 · 추적 동의 → `@skeleton/marketing` 의 `ConsentBanner`(브라우저 저장, 서버 기록 아님).

## 서버 렌더

import 때 브라우저 전역을 읽지 않는다. `ReconsentGate` 는 서버에서 자식을 그대로 그리고(`useSyncExternalStore` 의 서버 스냅샷 = idle) 하이드레이션 뒤에 확인한다.
