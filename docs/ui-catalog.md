# UI 카탈로그 — 부품 → 스토리 → 언제 쓰는가

화면을 짜기 전에 여기서 부품을 찾고 **스토리 파일을 열어 사용법을 그대로 따른다**. 스토리 하나가 그 부품의 보이는 모습 · 정본 사용법 · 실행되는 테스트(`play`)다.
`pnpm storybook`(http://localhost:6006)으로 눈으로 보고, `pnpm test:stories` 가 모든 스토리의 `play` 와 접근성 검사를 진짜 브라우저에서 돌린다.

이 표는 손으로 관리하되 `tests/stories.test.ts` 가 디스크의 스토리 파일과 어긋나지 않는지 확인한다 — 스토리를 더하거나 지우면 한 줄을 더하거나 지운다.
새 화면은 아래 「Patterns」에서 가장 가까운 것을 복사해 시작한다(에이전트 안내는 `CLAUDE.md`).

## @skeleton/ui — 부품

| 부품            | 스토리                                                    | 언제 쓰는가                                                               |
| --------------- | --------------------------------------------------------- | ------------------------------------------------------------------------- |
| `Button`        | `packages/ui/src/Button/Button.stories.tsx`               | 모든 클릭 동작. 일하는 중에는 `loading`, 폼 제출만 `type="submit"`        |
| `Input`         | `packages/ui/src/Input/Input.stories.tsx`                 | 한 줄 입력. 라벨이 필요하니 `Field` 안에서                                |
| `Field`         | `packages/ui/src/Field/Field.stories.tsx`                 | 라벨 · 도움말 · 오류를 입력칸에 이어 주는 래퍼 — 입력칸은 항상 이 안에    |
| `Select`        | `packages/ui/src/Select/Select.stories.tsx`               | 정해진 선택지 하나 고르기(`Field` 안에서)                                 |
| `Textarea`      | `packages/ui/src/Textarea/Textarea.stories.tsx`           | 여러 줄 입력(`Field` 안에서)                                              |
| `Checkbox`      | `packages/ui/src/Checkbox/Checkbox.stories.tsx`           | 폼에 모아 제출하는 예 · 아니오, 약관 동의, 전체 선택(indeterminate)       |
| `Switch`        | `packages/ui/src/Switch/Switch.stories.tsx`               | 누르면 바로 적용되는 켜짐 · 꺼짐 설정                                     |
| `Tabs`          | `packages/ui/src/Tabs/Tabs.stories.tsx`                   | 같은 화면 안의 구역 전환(화살표 · Home · End 키보드 지원)                 |
| `Table`         | `packages/ui/src/Table/Table.stories.tsx`                 | 행 · 열 데이터. 빈 목록은 `empty` 에 `EmptyState`                         |
| `Pagination`    | `packages/ui/src/Pagination/Pagination.stories.tsx`       | 쪽 이동(0 기반 `page` · `totalPages`)                                     |
| `EmptyState`    | `packages/ui/src/EmptyState/EmptyState.stories.tsx`       | 비어 있는 목록 · 검색 결과 · 없는 페이지, 다음에 할 일을 `action` 으로    |
| `Card`          | `packages/ui/src/Card/Card.stories.tsx`                   | 묶음 하나를 담는 면(제목 + 액션)                                          |
| `Dialog`        | `packages/ui/src/Dialog/Dialog.stories.tsx`               | 모달 — 삭제 확인 · 간단한 입력. 열림 상태는 부모가 쥔다                   |
| `Spinner`       | `packages/ui/src/Spinner/Spinner.stories.tsx`             | 화면 · 구역을 기다리는 중 표시                                            |
| `AppShell`      | `packages/ui/src/AppShell/AppShell.stories.tsx`           | 앱의 헤더 · 본문 · 푸터 틀 — 루트 레이아웃에서 한 번                      |
| `ErrorBoundary` | `packages/ui/src/ErrorBoundary/ErrorBoundary.stories.tsx` | 렌더링 오류를 잡아 대체 화면을 보인다(앱 루트 + 위험한 구역)              |
| `showApiError`  | `packages/ui/src/showApiError/showApiError.stories.tsx`   | API 오류 토스트(제목 · 상세 · traceId) — 보통 QueryClient `onError` 한 곳 |
| `toastPromise`  | `packages/ui/src/toast/toastPromise.stories.tsx`          | 약속 하나를 「로딩 → 성공/실패」 토스트 하나로                            |

## 다른 패키지의 부품 · 흐름

| 부품                           | 스토리                                                    | 언제 쓰는가                                              |
| ------------------------------ | --------------------------------------------------------- | -------------------------------------------------------- |
| `ThemeToggle`                  | `packages/theme/src/ThemeToggle.stories.tsx`              | system → light → dark 전환 버튼(헤더 `actions`)          |
| `ThemedToaster`                | `packages/theme/src/ThemedToaster.stories.tsx`            | 앱 루트에 한 번 — 토스트가 고른 테마를 따른다            |
| `NotificationBell`             | `packages/notifications/src/NotificationBell.stories.tsx` | 헤더의 종 + 안 읽은 수 + 받은편지함 대화상자             |
| `NotificationList`             | `packages/notifications/src/NotificationList.stories.tsx` | 받은편지함 목록만 따로(데이터는 호출하는 쪽이 준다)      |
| `Turnstile`                    | `packages/captcha-turnstile/src/Turnstile.stories.tsx`    | 로그인 · 가입 폼의 캡차 — 토큰이 올 때까지 제출을 막는다 |
| `RequireAuth`                  | `packages/auth/src/RequireAuth.stories.tsx`               | 로그인한 사람만 보는 라우트 가드(레이아웃 라우트)        |
| `useUpload`                    | `packages/storage/src/useUpload.stories.tsx`              | 파일 업로드 — 진행률 · 취소 · 검증 오류                  |
| `formatInstant` · `formatDual` | `packages/time/src/formats.stories.tsx`                   | 시각 3종(순간 · 달력 날짜 · 현지 + 내 시간대) 표시       |

## Patterns — 복사해서 시작하는 화면 틀

`@skeleton/ui` 만으로 짠 한 파일짜리 화면. 가장 가까운 것을 복사해 문구 · 데이터 연결만 바꾼다(숨은 도우미 파일 없음).

| 화면      | 스토리                                                  | 언제 복사하는가                                            |
| --------- | ------------------------------------------------------- | ---------------------------------------------------------- |
| 목록      | `apps/storybook/src/patterns/ListPage.stories.tsx`      | 표 + 쪽 이동 + 빈 상태 + 로딩 + 오류(다시 시도)            |
| 폼        | `apps/storybook/src/patterns/FormPage.stories.tsx`      | 입력 · 검증 오류(첫 오류로 포커스) · 제출 중 · 성공 · 실패 |
| 상세      | `apps/storybook/src/patterns/DetailPage.stories.tsx`    | 제목 + 탭 + 위험 구역(삭제 확인) · 로딩 · 없음             |
| 로그인    | `apps/storybook/src/patterns/LoginPage.stories.tsx`     | 이메일 · 비밀번호 · 제출 중 · 잘못된 계정 정보             |
| 권한 없음 | `apps/storybook/src/patterns/ForbiddenPage.stories.tsx` | 403 — 이유를 말하고 갈 곳을 준다                           |
| 설정      | `apps/storybook/src/patterns/SettingsPage.stories.tsx`  | 즉시 적용 스위치 + 저장 폼 + 위험 구역                     |

## 디자인 토큰

| 문서 | 스토리                                         | 언제 보는가                                                                                  |
| ---- | ---------------------------------------------- | -------------------------------------------------------------------------------------------- |
| 토큰 | `apps/storybook/src/tokens/Tokens.stories.tsx` | 색 · 간격 · 모서리 · 글자 크기 · 그림자 이름과 값(라이트 · 다크) — `var(--…)` 이름을 고를 때 |
