# @skeleton/author-profile

작성자 프로필 — 한 사람이 여러 닉네임(프로필)을 갖고 **글 · 댓글마다 골라 쓴다.** 두 프로필이 같은 사람이라는 사실은 다른 사용자에게 드러나지 않는다(같은 이름의 서로 다른 사람은 꼬리표로 구분: `이름#꼬리표`).
`createAuthorProfileApi` + TanStack Query 훅 + `AuthorPicker`(게시판 `authorPicker` 에 꽂는 선택기) + `AuthorProfileManager`(목록 · 추가 · 이름 바꾸기 · 삭제) + `createAuthorMemory`(기기 기억).
의존: `@skeleton/api-client`(`newIdempotencyKey` · `ApiRequestError`) · `@skeleton/ui`. peer: `react` `@tanstack/react-query`. **`@skeleton/board` 를 import 하지 않는다** — 둘은 서로를 모른 채 `authorPicker` 렌더 prop 한 곳에서 만난다(값은 문자열 id 하나).

## 어느 백엔드와 짝인가

백엔드 모듈 `author-profile`(+ `author-profile-jdbc`) — `account` 위에 얹힌다. HTTP 는 모듈이 연다: 기본 경로 `/api/v1/author-profiles` 가 이 패키지의 기본값(`basePath: '/author-profiles'`), `skeleton.author-profile.http.base-path` 를 바꿨다면 `createAuthorProfileApi(client, { basePath })`. 호출자는 `Authentication.name`(로그인 필요).

| 메서드 · 경로            | 이 패키지                                                                     | 오류                                                                                                                                                                                    |
| ------------------------ | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /config`            | `api.getConfig()` → `{ maxPerAccount, nameMaxLength }`                        |                                                                                                                                                                                         |
| `GET /`                  | `api.list()` → `[{ id, name, tag, createdAt }]`(내 살아 있는 프로필)          |                                                                                                                                                                                         |
| `POST /` `{ name }`      | `api.create({ name }, { idempotencyKey? })` — 201                             | 400 이름 칸(`errors[].field = "name"`, 코드는 닉네임과 같다: `Required` · `Size` · `Pattern` · `Reserved`) · 409 `AUTHOR_PROFILE.NAME_TAKEN` · 409 `LIMIT_REACHED` · 429 `RATE_LIMITED` |
| `PATCH /{id}` `{ name }` | `api.rename(id, { name })` — 200                                              | 같은 오류                                                                                                                                                                               |
| `DELETE /{id}`           | `api.remove(id)` — 204. 되돌릴 수 없고 글 · 댓글은 「삭제된 사용자」로 남는다 |                                                                                                                                                                                         |
| 남의 · 없는 · 지워진 id  |                                                                               | 모두 같은 404 `AUTHOR_PROFILE.NOT_FOUND`                                                                                                                                                |

코드는 `ErrorCodes.AUTHOR_PROFILE_*`(`@skeleton/api-client`). 프로필 `id`(`prf_…`)는 게시판이 공개 작성자 id 로 쓰는 값이다 — **계정 id 가 아니다.** 이 패키지는 계정 id 를 받지도, 그리지도 않는다(기기 기억의 저장소 키 안에만 — 아래).

## 쓰는 법

```tsx
// src/author/api.ts — 앱이 한 번 만든다
export const profileApi = createAuthorProfileApi(apiClient)

// 게시판 폼에 선택기 꽂기 — board 의 authorPicker 렌더 prop 이 { value, onChange, threadAuthorId, invalid, disabled } 를 준다
const memory = useMemo(() => createAuthorMemory(browserLocalStorage(), me.id), [me.id])
<PostEditor authorRequired={config.authorRequired}
  authorPicker={(args) => <AuthorPicker {...args} api={profileApi} boardCode={code} memory={memory}
    labels={tr.picker} onCreateProfile={() => navigate('/settings#profiles')} />} … />
<BoardComments authorPicker={…같은 함수…} … />

// 설정 화면의 프로필 구역 — 이름 바꾸기 · 지우기는 글 쪽 이름도 바꾸므로 board 캐시를 함께 갱신
<AuthorProfileManager api={profileApi} labels={tr.manager} alsoInvalidate={[boardKeys.all]} />

// 로그아웃 때
memory.forget()
```

- `authorPicker` 는 **렌더 함수**라 안에서 훅을 쓰면 안 된다 — 위처럼 컴포넌트(`<AuthorPicker …/>`)를 돌려준다.
- 전역 오류 토스트(`QueryClient` 의 `onError`)는 `isAuthorProfileFormError(error)` 인 것을 건너뛴다 — 폼이 제자리에서 말한다(안 그러면 같은 말이 두 번 나온다).
- 첫 프로필 만들기(`onCreateProfile`)로 어디로 가는지는 앱이 정한다(설정 화면으로 이동 · 창 열기).

동작하는 모양은 `src/AuthorPicker.stories.tsx` · `src/AuthorProfileManager.stories.tsx`(가짜 서버 `src/stories/fakeAuthorProfiles.ts`).

## 공개 표면

| export                                                                                                                      | 뜻                                                                                                                                                                                                                        |
| --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `createAuthorProfileApi(client, { basePath? })`                                                                             | 위 표의 다섯 호출. 만들기에는 `Idempotency-Key`(기본 새 키, 같은 제출을 다시 보낼 때만 `{ idempotencyKey }` 로 같은 키)                                                                                                   |
| `authorProfileKeys` · `configQuery` · `listQuery`                                                                           | 쿼리 정의(키 + 함수). 키는 `author-profile` 한 뿌리                                                                                                                                                                       |
| `useAuthorProfiles` · `useAuthorProfileConfig`                                                                              | 읽기(설정은 5분 동안 다시 가져오지 않는다)                                                                                                                                                                                |
| `useCreateAuthorProfile` · `useRenameAuthorProfile(api, alsoInvalidate?)` · `useRemoveAuthorProfile(api, alsoInvalidate?)`  | 쓰기. 끝나면 목록을 다시 가져온다(성공이든 실패든 — 상한 · 지워짐은 서버가 아는 사실). `alsoInvalidate` 는 작성자 이름이 걸린 다른 캐시(게시판 `[['board']]`). `mutate({ name })` · `mutate({ id, name })` · `mutate(id)` |
| `AuthorPicker` `{ api, boardCode, value, onChange, threadAuthorId, invalid, disabled, memory?, onCreateProfile?, labels? }` | 목록을 `useAuthorProfiles` 로 가져와 `AuthorPickerView` 를 그린다. 불러오는 중 · 실패(누르면 다시)도 단추 모양                                                                                                            |
| `AuthorPickerView`                                                                                                          | 목록을 이미 가진 선택기(`profiles` prop) — 서버 렌더 · 시험 · 스토리용                                                                                                                                                    |
| `AuthorProfileManager` `{ api, labels?, alsoInvalidate? }`                                                                  | 목록 · 추가(이름 칸 + 단추) · 줄마다 이름 바꾸기(제자리 폼) · 삭제(`ConfirmDialog`). 상한이면 추가가 꺼지고 이유가 먼저 보인다                                                                                            |
| `createAuthorMemory(storage, accountId)` · `browserLocalStorage()`                                                          | 기기 기억(아래)                                                                                                                                                                                                           |
| `resolveInitialAuthor` · `switchNotice`                                                                                     | 처음 값 세 단계 · 한 줄 확인이 필요한가 — 순수 함수(선택기가 쓴다. 다른 모양의 선택기를 만들 때도)                                                                                                                        |
| `profileFormProblem` · `nameProblem` · `isAuthorProfileFormError`                                                           | 서버 답 → 이름 칸 / 폼 문장 · 서버에 묻기 전 이름 검사(비었음 · 길이 · `#` `@`) · 전역 토스트가 건너뛸 오류인가                                                                                                           |
| `defaultAuthorProfileLabels` · `AuthorProfileLabels`                                                                        | 모든 문구(영어 기본값). 앱이 번역해 `labels` prop 으로 일부 또는 전부를 덮는다                                                                                                                                            |
| `profileDisplay(profile)`                                                                                                   | `이름#꼬리표`                                                                                                                                                                                                             |

## 선택기가 지키는 것 (실수 · 노출 방지)

- 접힌 상태는 **지금 고른 `이름#꼬리표` 하나**만 늘 보인다(제출 단추 옆, 테두리가 있는 단추 모양 + ▾). 목록은 눌러야 열린다 — 메뉴 단추 패턴(`menuitemradio` · ↑↓ Home End · Esc 는 단추로 포커스 복귀). 고르지 않았으면 「프로필 고르기」 단추.
- **처음 값**: ① 이 스레드에서 쓴 프로필(`threadAuthorId`) → ② 이 기기가 기억하는 이 게시판의 마지막 프로필 → ③ 비어 있음(`authorRequired` 면 골라야 보낼 수 있다 — 막는 것은 board). 프로필이 하나뿐이어도 추측해서 채우지 않는다. 지운 프로필 id 는 건너뛴다.
- **이 스레드에서 쓴 프로필과 다른 것으로 바꿀 때만** 한 줄 확인(`labels.switchNotice` · 「그래도 ○○로」 · 「○○ 유지」). 같은 프로필이면 묻지 않고, 확인 전까지 값은 그대로다. **늘 떠 있는 경고는 없다** — 그 자체가 노출이다.
- 프로필이 하나도 없으면 「프로필 만들기」 단추(`onCreateProfile`) — 빈 메뉴를 열지 않는다.
- 사람이 고른 것만 기기에 기억한다(처음 값은 쓰지 않는다).
- **계정 id 는 DOM · aria 어디에도 없다.** 프로필 id 도 글자로 그리지 않는다(`value` 는 상태일 뿐).

## 기기 기억 `createAuthorMemory(storage, accountId)`

`localStorage` 한 겹 — `get(boardCode)` · `set(boardCode, profileId | undefined)` · `forget()`.

- 키 `skeleton.author-profile:<계정 id>:<게시판 코드>`(둘 다 URL 인코딩) — **계정 id 는 저장소 키 안에만** 있고 값은 프로필 id 하나다. 계정이 바뀌어도 서로 섞이지 않는다.
- `forget()` 은 **로그아웃 때** 부른다 — 이 모듈이 쓴 키를 모든 계정 · 모든 게시판 만큼 지운다(기기를 같이 쓰는 사람에게 남기지 않는다). 다른 저장 값은 건드리지 않는다.
- 저장소 접근 예외(차단 · 가득 참)는 삼킨다 — 기억은 편의다. `browserLocalStorage()` 는 접근만으로 던지는 환경과 서버 렌더에서 `undefined`(그러면 아무것도 기억하지 않는다). 모듈을 불러올 때는 저장소를 건드리지 않는다(SSR 안전).

## 문구 · 접근성

문구는 전부 `labels` prop(`AuthorProfileLabels`, 기본 영어) — ko/en 은 앱이 공급한다. 눌리는 것은 모두 테두리 · 배경이 있는 단추다(글자만 있는 단추 없음). 선택기 단추의 낭독 이름은 `labels.triggerLabel(current)` — 보이는 글자(`이름#꼬리표`)를 포함하게 쓴다. 한 줄 확인은 `role="status"`, 폼 오류는 `Field` 의 `role="alert"`. 색은 의미 토큰만.

## 테스트

`pnpm test`(이 폴더) — API 경로 · 쿼리 키 · 변경 뒤 무효화 · 기기 기억 · 처음 값 세 단계 · 바꿀 때 확인 · 오류 문장 · 서버 렌더 마크업(계정 id 없음). 동작은 스토리의 `play`(`pnpm test:stories`, 진짜 브라우저 + a11y).
