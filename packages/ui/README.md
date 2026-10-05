# @skeleton/ui

중립 UI — 색은 **의미 토큰만** 쓴다(`@skeleton/tokens` 의 `tokens.css` 가 먼저 로드되어야 한다). 사용자에게 보이는 문구는 전부 prop(기본 영어).
의존: `@skeleton/api-client`(`showApiError` 의 `ApiRequestError`). peer: `react` `sonner`.

```ts
import '@skeleton/tokens/tokens.css'
import '@skeleton/ui/base.css' // 리셋 + 중립 요소 타이포(h1~h3 · p · code · pre · 폼 요소 폰트). 레이아웃 · 화면 모양은 없다
import { Button, Card, Field, Input } from '@skeleton/ui'
```

| export                               | props (요약)                                                                                                                                                                       |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Button`                             | `variant` primary·secondary·ghost·danger · `size` sm·md·lg · `loading` · `loadingLabel`(기본 `Loading`) · 네이티브 button props. 기본 `type="button"`                              |
| `Input` · `Select`                   | 네이티브 props + `invalid`(→ `aria-invalid` + 오류 테두리)                                                                                                                         |
| `Field`                              | `label` `hint` `error` `required` `requiredMark`(기본 `*`) · children 은 render prop: `{(control) => <Input {...control} />}` — `id` · `aria-describedby` · `invalid` 를 이어 준다 |
| `Card`                               | `title` `actions` — `title` 이 있으면 section 이 그 제목으로 labelled                                                                                                              |
| `Dialog`                             | `open` `onClose` `title` `closeLabel`(기본 `Close`) `footer` — 네이티브 `<dialog>` 모달                                                                                            |
| `Spinner`                            | `label`(기본 `Loading`) — `role="status"`                                                                                                                                          |
| `AppShell`                           | `brand` `nav` `actions` `footer` — 헤더 + 본문 + 푸터. 라우터를 모른다                                                                                                             |
| `ErrorBoundary`                      | `fallback?(error, reset)` · `title`(기본 `Something went wrong`) · `retryLabel`(기본 `Try again`)                                                                                  |
| `showApiError(error, { messages? })` | API 에러 토스트(title · detail · 클릭 복사 traceId · spanId). `messages`: `traceIdCopied` `clickToCopy`                                                                            |

부품 모양은 CSS Modules + 의미 토큰이라 테마(라이트/다크)를 그대로 따른다. 모양을 바꾸고 싶으면 `tokens.json` 값을 바꾼다 — 내부 CSS 를 고치지 않는다.
