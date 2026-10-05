# @skeleton/ui

중립 UI — 색은 **의미 토큰만** 쓴다(`@skeleton/tokens` 의 `tokens.css` 가 먼저 로드되어야 한다). 사용자에게 보이는 문구는 전부 prop(기본 영어).
의존: `@skeleton/api-client`(`showApiError` 의 `ApiRequestError`). peer: `react` `sonner`.

```ts
import '@skeleton/tokens/tokens.css'
import '@skeleton/ui/base.css' // 리셋 + 중립 요소 타이포(h1~h3 · p · code · pre · 폼 요소 폰트). 레이아웃 · 화면 모양은 없다
import { Button, Card, Field, Input } from '@skeleton/ui'
```

| export                                                | props (요약)                                                                                                                                                                                                                  |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Button`                                              | `variant` primary·secondary·ghost·danger · `size` sm·md·lg · `loading` · `loadingLabel`(기본 `Loading`) · 네이티브 button props. 기본 `type="button"`                                                                         |
| `Input` · `Select` · `Textarea`                       | 네이티브 props + `invalid`(→ `aria-invalid` + 오류 테두리). `Textarea` 는 `rows` 기본 3                                                                                                                                       |
| `Field`                                               | `label` `hint` `error` `required` `requiredMark`(기본 `*`) · children 은 render prop: `{(control) => <Input {...control} />}` — `id` · `aria-describedby` · `invalid` 를 이어 준다                                            |
| `Checkbox` · `Switch`                                 | `label`(글자도 눌린다) `description` · `Checkbox` 는 `error`(`role=alert`) · `indeterminate`(`aria-checked=mixed`). `Switch` 는 `role="switch"` 를 단 네이티브 체크박스. 네이티브 props(`checked` `onChange` `name` …) 그대로 |
| `Tabs`                                                | `items: {id,label,content,disabled?}[]` `value`/`onValueChange`(제어) 또는 `defaultValue` · `orientation` · `aria-label`. WAI-ARIA tabs: roving tabindex, 화살표 · Home · End(`nextTabId`), 포커스 이동 = 선택                |
| `Table`                                               | `caption` `columns: {key,header,render,align?,rowHeader?}[]` `rows` `rowKey` `empty`. 정렬 · 선택 · 가상화는 없다. 스크롤 영역은 `role=region` + `tabindex=0` 이라 키보드로 스크롤된다                                        |
| `Pagination`                                          | `page`(0 기반, `PaginationMeta.page`) `totalPages` `onPageChange` `siblings` · `label` `previousLabel` `nextLabel` `pageLabel(n)`(기본 영어). 쪽이 1 이하면 그리지 않는다(`paginationItems` 도 export)                        |
| `EmptyState`                                          | `title` `description` `icon`(낭독기에서 숨김) `action` `headingLevel`(기본 3)                                                                                                                                                 |
| `toastPromise(promise, { loading, success, error? })` | 로딩 → 성공/실패가 같은 토스트에서 바뀐다. 값은 돌려주고 실패는 다시 던진다. `ApiRequestError` 면 title + detail. 세 번째 인자로 `toast` 를 바꿔 끼울 수 있다(테스트)                                                         |
| `Card`                                                | `title` `actions` — `title` 이 있으면 section 이 그 제목으로 labelled                                                                                                                                                         |
| `Dialog`                                              | `open` `onClose` `title` `closeLabel`(기본 `Close`) `footer` — 네이티브 `<dialog>` 모달                                                                                                                                       |
| `Spinner`                                             | `label`(기본 `Loading`) — `role="status"`                                                                                                                                                                                     |
| `AppShell`                                            | `brand` `nav` `actions` `footer` — 헤더 + 본문 + 푸터. 라우터를 모른다(현재 쪽 링크 `aria-current="page"` 를 칠한다 · 좁은 틀에서는 내비가 둘째 줄)                                                                           |
| `PageHeader`                                          | `title`(화면의 `h1`) `description` `actions`(오른쪽 · 좁으면 아래로) `back`(제목 위 자리) — 화면의 첫 줄                                                                                                                      |
| `Badge`                                               | `tone`(`neutral` `info` `success` `warning` `danger`) · children — 상태 알약, 뜻은 글자로                                                                                                                                     |
| `Progress`                                            | `label`(낭독 이름, 필수) `value`(0~1, 없으면 끝을 모르는 진행) `valueText`                                                                                                                                                    |
| `FilePicker`                                          | `title` `hint` `buttonLabel` `accept` `multiple` `disabled` `loading` `onFiles(files)` `invalid` `error` — 끌어다 놓기 + 버튼. 날 `<input type="file">` 대신                                                                  |
| `Stat`                                                | `label` `value` `hint` `tone`(`neutral` `accent` `warning`) — 대시보드 숫자 한 칸                                                                                                                                             |
| `ErrorBoundary`                                       | `fallback?(error, reset)` · `title`(기본 `Something went wrong`) · `retryLabel`(기본 `Try again`)                                                                                                                             |
| `showApiError(error, { messages? })`                  | API 에러 토스트(title · detail · 클릭 복사 traceId · spanId). `messages`: `traceIdCopied` `clickToCopy`                                                                                                                       |

부품 모양은 CSS Modules + 의미 토큰이라 테마(라이트/다크)를 그대로 따른다. 모양을 바꾸고 싶으면 `tokens.json` 값을 바꾼다 — 내부 CSS 를 고치지 않는다.

## 키보드 · 포커스

- 네이티브 요소를 우선한다: `Checkbox` · `Switch` 는 `<input type=checkbox>`, `Dialog` 는 `<dialog>`, `Textarea` · `Select` 는 네이티브 — Space · 폼 제출 · 포커스는 브라우저가 한다.
- 새 부품의 포커스 링은 `:focus-visible` 에 `outline: 2px solid var(--teal)`(대비 3:1 짝은 `tests/contrast.test.ts`). 입력칸류는 기존대로 `--teal` 테두리 + `--teal-soft` 윤곽.
- 라벨 · 설명 · 오류는 `aria-describedby` / `role=alert` / `aria-invalid` 로 이어진다(`Field` 와 같은 규칙).
- 테스트는 DOM 없이(`renderToStaticMarkup` + 순수 함수 `nextTabId` · `paginationItems`) 마크업 · aria 속성 · 키 매핑을 잰다. **테스트하지 않는 것**: 실제 포커스 이동(`Tabs` 화살표 뒤 `focus()`) · 클릭/키 이벤트 처리 · `Checkbox` 의 `indeterminate` DOM 프로퍼티 · 시각(포커스 링 모양 · 스위치 움직임). 브라우저에서 한 번 눌러 확인한다.
