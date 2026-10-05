# @skeleton/board

게시판 — 글 · 중첩 댓글(대댓글) · **타입이 있는 반응**(좋아요 · 싫어요 · 공감 …) 클라이언트 + TanStack Query 훅(반응은 낙관적 갱신) + `PostList` · `PostDetail` · `PostEditor` · `CommentThread` · `ReactionBar`(+ 서버와 이어진 `BoardComments` · `PostReactionBar`).
의존: `@skeleton/api-client`(`newIdempotencyKey`) · `@skeleton/time`(`formatInstant`) · `@skeleton/ui`. peer: `react` `@tanstack/react-query`(앱에 `sonner` 도 — `ui` 가 쓴다). 백엔드 모듈 `board`(+ `board-jdbc`)의 HTTP 계약만 겨냥하고, 그 밖의 패키지 · 앱 코드는 모른다.

**반응 종류는 서버가 알려 주는 코드다.** 이 패키지는 `LIKE` 도 `EMPATHY` 도 모른다 — `GET /boards/config` 의 `reactionTypes` 를 그대로 그리고, 보이는 글자 · 아이콘은 prop 맵으로 받는다. 「공감」을 더하는 일은 서버 설정 한 줄 + 앱의 맵 한 줄이고 이 패키지는 고치지 않는다(아래 「반응 종류를 더하려면」).

## 어느 백엔드와 짝인가

| 쓰는 것                 | 백엔드(kotlin-skeleton)                                                                                                                                                                                                                                                                                             |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **HTTP 엔드포인트**     | **`modules/board` 가 연다**(서블릿 앱 + Spring Security — 호출자 = `Authentication.name`, 기본은 로그인 필요, `skeleton.board.http.allow-anonymous-read=true` 면 읽기만 익명). 기본 경로 `/api/v1/boards` 가 이 패키지의 기본값(`basePath: '/boards'`). 다른 경로로 열었다면 `createBoardApi(client, { basePath })` |
| 저장소                  | `board-jdbc`                                                                                                                                                                                                                                                                                                        |
| 반응 종류 · 모드 · 한도 | 설정 `skeleton.board.reaction.types`(기본 `LIKE,DISLIKE`) · `reaction.mode`(`SINGLE` 기본 · `PER_TYPE`) · `max-comment-depth`(기본 2) · `title-max-length` · `body-max-length` · `comment-max-length` · `max-page-size` → 전부 `GET /boards/config` 로 화면에 알려진다                                              |
| 운영자                  | `skeleton.board.moderator-role`(기본 `MODERATOR`) — 호출자가 그 역할이면 `config.canModerate`                                                                                                                                                                                                                       |

| 이 패키지의 타입 (`types.ts`)                                                | Kotlin DTO (`modules/board/.../board/web/BoardDtos.kt`)                                                             |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `BoardConfig`                                                                | `BoardConfigResponse`                                                                                               |
| `Board`                                                                      | `BoardResponse`                                                                                                     |
| `PostSummary` · `PostDetail`                                                 | `PostSummaryResponse` · `PostDetailResponse`                                                                        |
| `Comment` · `CommentWithReplies`(계약의 `CommentThread`)                     | `CommentResponse`(최상위만 `replies` 를 가진다 — 한 건 응답에는 없다)                                               |
| `ReactionState`                                                              | `ReactionStateResponse`                                                                                             |
| `PostInput` · `PostPatch` · `PostModeration` · `CommentInput` · `BoardInput` | `CreatePostRequest` · `UpdatePostRequest` · `PostModerationRequest` · `CreateCommentRequest` · `CreateBoardRequest` |
| `ErrorCodes.BOARD_*`(`@skeleton/api-client`)                                 | `BoardErrorCode`                                                                                                    |

글 · 댓글 id 는 Kotlin `Long` 이라 JSON 숫자 → `BoardId = number`. 반응 개수는 서버가 **설정된 종류 전부(0 포함)** 를 준다 — 이 패키지는 없는 종류도 0 으로 읽는다(`reactionCount`).

## 쓰는 법

```tsx
// src/board/api.ts — 앱이 한 번 만든다(경로는 모듈이 연 /api/v1/boards 가 기본값)
export const boardApi = createBoardApi(apiClient /*, { basePath: '/boards' }*/)

// 목록 — 보이기만 하는 PostList 에 훅을 잇는다(조건은 주소 검색 인자에 두면 새로고침 · 뒤로가기가 된다)
const posts = usePosts(boardApi, code, { sort, q, page })
<PostList posts={posts.data?.values ?? []} page totalPages={…} sort query onSortChange onSearch onPageChange renderTitle={(p) => <Link to={`/board/${p.id}`}>{p.title}</Link>} />

// 글 + 반응 + 댓글
const config = useBoardConfig(boardApi).data          // 반응 종류 · 한도 · canModerate
<PostDetail post={post} reactions={<PostReactionBar api={boardApi} boardCode={code} post={post} config={config} labels={{ EMPATHY: '공감' }} icons={{ EMPATHY: '🤝' }} />} />
<BoardComments api={boardApi} boardCode={code} postId={post.id} config={config} currentUserId={me} reactionLabels={{ EMPATHY: '공감' }} />

// 글쓰기 — PostEditor 가 검증하고, 보내는 일은 mutation
const create = useCreatePost(boardApi, code)
<PostEditor limits={config} onSubmit={(v) => create.mutateAsync({ input: v })} submitting={create.isPending} />
```

동작하는 전체 모양은 `src/BoardPage.stories.tsx`(목록 → 글 → 글쓰기를 훅으로 조립)와 `apps/sample` 의 「게시판」 화면(`BoardPage` · `BoardPostPage` · `BoardFormPage`).

## 공개 표면

| export                                                                                                                                                        | 뜻                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `createBoardApi(client, { basePath? })`                                                                                                                       | 모든 엔드포인트: `getConfig` · `listBoards` · `getBoard` · `createBoard` · `listPosts`(페이지) · `getPost` · `createPost` · `updatePost` · `removePost` · `moderatePost` · `listComments`(최상위 단위 페이지) · `createComment` · `updateComment` · `removeComment` · `moderateComment` · `putReaction` · `removeReaction`. 만들기(`createBoard` · `createPost` · `createComment`)에는 `Idempotency-Key` — 기본 새 키, 같은 제출을 다시 보낼 때만 `{ idempotencyKey }` 로 같은 키 |
| `boardKeys` · `configQuery` · `boardsQuery` · `boardQuery` · `postListQuery` · `postQuery` · `commentListQuery`                                               | 쿼리 정의(키 + 함수) — 훅과 따로라 가짜 api 로 재고 서버 렌더 `prefetch` 에도 쓴다. 키는 `board` 한 뿌리, 글은 `posts(code)` ⊃ `postLists` · `post`, 댓글은 `comments(code, postId)`                                                                                                                                                                                                                                                                                              |
| `useBoardConfig` · `useBoards` · `useBoard` · `usePosts` · `usePost` · `useComments`                                                                          | 읽기. 목록 · 댓글은 쪽을 넘길 때 이전 쪽을 보여 주며 새로 가져온다. `usePost` 는 창을 다시 눌러도 다시 가져오지 않는다(서버가 불러올 때마다 조회수를 올린다)                                                                                                                                                                                                                                                                                                                      |
| `useCreatePost` · `useUpdatePost` · `useModeratePost` · `useRemovePost` · `useCreateComment` · `useUpdateComment` · `useRemoveComment` · `useModerateComment` | 쓰기. 성공하면 캐시를 고친다(`mutations.ts` — 아래 「갱신 규칙」). 에러 토스트는 앱의 QueryClient 전역 핸들러                                                                                                                                                                                                                                                                                                                                                                     |
| `useReaction(api, code, mode)`                                                                                                                                | 글 · 댓글의 반응 누르기. `mutate({ target, type, active })` — 낙관적 갱신, 실패하면 되돌림. `mode` 는 `config.reactionMode`                                                                                                                                                                                                                                                                                                                                                       |
| `applyReaction` · `removeReaction` · `reactionCount`                                                                                                          | 서버가 반응을 세는 규칙(SINGLE 은 바꾸기 · PER_TYPE 은 종류별)의 순수 함수 — 낙관적 갱신이 쓴다                                                                                                                                                                                                                                                                                                                                                                                   |
| `nestThread(thread)`                                                                                                                                          | 서버가 평평하게 준 「최상위 + 모든 자손」 → 트리(`CommentNode`: `comment` · `children` · `descendantCount`). 부모를 못 찾은 자손은 최상위 아래에 붙인다                                                                                                                                                                                                                                                                                                                           |
| `reactionMutationOptions` · `createPostMutation` … `moderateCommentMutation`                                                                                  | 훅이 감싼 `useMutation` 옵션 함수 — 직접 `MutationObserver` 로 재거나 다른 훅 모양이 필요할 때                                                                                                                                                                                                                                                                                                                                                                                    |
| `<ReactionBar types counts mine onToggle labels icons groupLabel disabled />`                                                                                 | 보이기만. `role="group"` + 종류마다 `aria-pressed` 단추(이름 = 「라벨 개수」, 아이콘은 `aria-hidden`). `types` 에 있는 것만 그린다. 라벨 맵에 없으면 코드가 글자. `onToggle(type, active)` 의 `active` 는 누른 뒤의 상태                                                                                                                                                                                                                                                          |
| `<PostList posts page totalPages sort query … renderTitle actions emptyAction labels />`                                                                      | 보이기만. 정렬 · 검색(Enter 로 확정) · 쪽 · 고정 알약 · 상태 알약 · 댓글/반응/조회 수 · 빈 상태 두 가지(처음 · 검색 결과 없음) · 로딩 · 오류(다시 시도)                                                                                                                                                                                                                                                                                                                           |
| `<PostDetail post reactions onEdit onDelete onModerate labels />`                                                                                             | 보이기만. 콜백을 준 단추만 생긴다(삭제 확인 대화상자는 부모 몫). 운영자: 고정/해제 · 숨김/복구                                                                                                                                                                                                                                                                                                                                                                                    |
| `<PostEditor limits initial onSubmit submitting error fieldErrors labels />`                                                                                  | 제목 · 본문 폼 — 제출 때 검증(비었거나 `limits` 초과 → 칸 아래 + 첫 오류 칸 포커스). 서버 오류는 `error`(폼 전체) · `fieldErrors`(칸별)로 부모가 준다                                                                                                                                                                                                                                                                                                                             |
| `<CommentThread thread maxDepth commentMaxLength collapseFromDepth onReply onEdit onDelete onModerate onReact … />`                                           | 보이기만. 트리 · 답글 칸 · 내 댓글 수정/삭제 · 운영자 숨김/복구 · 반응 · 깊은 답글 접기(`collapseFromDepth` 기본 2 → 「답글 N개 더 보기」) · 지운/숨긴 자리 표시 문구(`labels.deleted` · `labels.hidden`)                                                                                                                                                                                                                                                                         |
| `<BoardComments api boardCode postId config … labels />`                                                                                                      | **서버와 이어진** 댓글 영역: 최상위 단위 쪽 · 정렬 · 새 댓글 · 답글 · 수정 · 삭제(확인 대화상자) · 숨김 · 낙관적 반응 · 로딩 · 오류 · 빈 상태                                                                                                                                                                                                                                                                                                                                     |
| `<PostReactionBar api boardCode post config labels icons />`                                                                                                  | 서버와 이어진 글의 반응 줄 — 종류 · 모드는 `config` 에서                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 타입                                                                                                                                                          | `BoardConfig` · `PostSummary` · `PostDetailData`(컴포넌트 `PostDetail` 과 겹치지 않게) · `Comment` · `CommentWithReplies` · `ReactionState` · `ReactionTarget` · `PostListParams` · `BoardApi` … `*Labels`                                                                                                                                                                                                                                                                        |

**글자는 전부 prop(기본 영어)** — 컴포넌트마다 `labels` 객체(일부만 덮어쓴다)와 `formatTime`(기본 `formatInstant`), 작성자 표시 `renderAuthor`(서버 계약에는 이름이 없고 계정 id 뿐이다). 색 · 간격은 의미 토큰만, 모양은 CSS Modules.

## 반응 종류를 더하려면 (「공감」 예)

1. **서버**: 설정에 코드를 더한다 — `skeleton.board.reaction.types: LIKE,DISLIKE,EMPATHY`(스키마 · 코드 변경 없음). `GET /boards/config` 가 `reactionTypes` 에 `EMPATHY` 를 싣는다.
2. **앱**: 보이는 글자 · 아이콘 맵에 한 줄씩 — 글 · 댓글에 같은 맵을 넘긴다.

   ```tsx
   const labels = { LIKE: '좋아요', DISLIKE: '싫어요', EMPATHY: '공감' }
   const icons = { LIKE: '👍', DISLIKE: '👎', EMPATHY: '🤝' } // 장식 — 낭독기에서는 숨긴다
   <PostReactionBar … labels={labels} icons={icons} />
   <BoardComments … reactionLabels={labels} reactionIcons={icons} />
   ```

3. 끝. 이 패키지(타입 유니온 · switch · 컴포넌트)는 고치지 않는다. 맵을 안 주면 코드(`EMPATHY`)가 글자로 보이고, 아이콘이 없으면 글자만 보인다.

모드는 서버 설정: `SINGLE`(기본)이면 한 사람이 한 대상에 반응 하나 — 다른 종류를 누르면 옮겨 가고, `PER_TYPE` 이면 종류마다 하나씩 여럿. 화면은 `config.reactionMode` 를 `useReaction` 에 넘기기만 하면 낙관적 계산이 같은 규칙을 따른다.

## 갱신 규칙 (무엇이 무엇을 다시 가져오는가)

| 변경                    | 캐시                                                                                                                                                                              |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 글 만들기               | 응답으로 상세를 채우고, 글 목록 · 게시판 목록(`postCount`)을 다시 가져온다                                                                                                        |
| 글 고치기 · 숨김/고정   | **응답으로 상세를 바꾼다**(다시 가져오면 조회수가 오른다) + 글 목록을 다시 가져온다                                                                                               |
| 글 지우기               | 상세를 버리고 목록 · 게시판 목록을 다시 가져온다                                                                                                                                  |
| 댓글 만들기             | 그 글의 댓글 목록을 다시 가져오고, 글 상세 · 목록의 `commentCount` 를 로컬에서 +1                                                                                                 |
| 댓글 수정 · 삭제 · 숨김 | 그 글의 댓글 목록을 다시 가져온다(지운 자리는 서버가 본문 null 로 돌려준다)                                                                                                       |
| **반응 누르기**         | **다시 가져오지 않는다**: 누르는 즉시 상세 · 모든 목록 쪽 · 댓글 트리를 서버가 셀 값으로 바꾸고(낙관적), 실패하면 눌렀던 캐시를 그대로 되돌리고, 성공하면 서버가 준 집계로 덮는다 |

## 테스트가 재지 않는 것

`createBoardApi` 경로 · 메서드 · 헤더(`Idempotency-Key`) · 파라미터, 반응 계산(SINGLE/PER_TYPE · 0 아래로 안 내려감), 트리 만들기, 낙관적 갱신 · 되돌리기 · 서버 값 덮기(실제 `QueryClient` + `MutationObserver`), 변경별 무효화, 가짜 서버가 계약을 지키는지(`src/stories/fakeBoard.test.ts`), 마크업(`renderToStaticMarkup`)은 vitest 가 잰다. 클릭 · 키보드 · 포커스 · 접힘 · 대화상자 · 낙관적 갱신이 화면에 보이는지는 **스토리의 `play`**(`pnpm test:stories`, 진짜 브라우저 + a11y)가 잰다. **재지 않는다**: 진짜 백엔드와의 왕복 — `apps/sample` 의 e2e(`board.e2e.ts`)가 잰다.

## Decisions (결정과 버린 대안)

- **보이기만 하는 부품 + 이은 부품 둘 다** — `PostList` · `PostDetail` · `PostEditor` · `CommentThread` · `ReactionBar` 는 데이터와 콜백만 받는다(라우터 · 주소 · 확인 대화상자는 앱 몫, 스토리로 재기 쉽다). 서버와 이어 쓰면 매번 같은 배선(댓글 mutation 여섯 · 삭제 확인 · 낙관적 반응)이라 `BoardComments` · `PostReactionBar` 만 `api` 를 받는 이은 부품으로 더했다. 알림 패키지의 `NotificationBell`(이음) / `NotificationList`(보이기) 와 같은 선이다. _버린 것_: 모든 부품을 `api` 를 받는 이은 부품으로(주소 · 라우터 결합, 가짜 서버 없이 못 쟀다) · 전부 보이기만(앱마다 댓글 배선을 되풀이).
- **반응은 낙관적 갱신 + 되돌리기** — 누름은 값이 작고 서버가 거절하는 일이 드물어 즉시 반응하는 것이 낫다. 서버의 `ReactionState` 가 오면 그것이 이기고(추측과 달라도 바로잡힌다), 반응 때문에 글 상세를 다시 가져오지 않는다(조회수가 오른다). 계산 규칙은 서버와 같게 `reactions.ts` 에 순수 함수로 두었고 가짜 서버는 일부러 따로 다시 썼다(같은 코드면 서로를 검증하지 못한다). _버린 것_: 응답을 기다린 뒤 갱신(눌러도 반응이 없어 보인다) · 반응마다 목록 무효화(조회수 · 깜박임) · 여러 요청이 겹칠 때의 큐(되돌리기는 눌렀던 시점의 스냅샷 — 빠른 연타 중 하나가 실패하면 그 이전 상태로 돌아가고 서버 값이 뒤따라 오는 쪽이 단순했다).
- **댓글 트리는 서버가 평평하게 준 것을 클라이언트가 중첩한다**(`nestThread`) — 서버 계약이 「최상위 단위 쪽 + 모든 자손(작성 순)」이라 쪽 경계가 트리를 가르지 않는다. 접기는 `collapseFromDepth`(기본 2 = 서버 기본 `maxCommentDepth` 의 맨 아래 단) 이상 깊이의 답글을 「답글 N개 더 보기」(N = 모든 자손) 뒤에 둔다. 방금 단 답글이 접힌 칸에 숨지 않게 답글을 달면 그 칸을 펼친다. _버린 것_: 깊이에 비례하는 들여쓰기(좁은 화면에서 본문이 사라진다) · 모든 답글을 항상 펼침(깊은 줄기가 화면을 점령) · 서버가 트리를 중첩해서 줌(계약 변경 + 쪽 경계 문제).
- **지운 · 숨긴 댓글은 자리를 지키고 글은 prop** — 서버는 소프트 삭제된 댓글을 본문 null + `status` 로 돌려준다. 화면은 `labels.deleted` · `labels.hidden`(기본 영어)을 그 자리에 보여 답글이 매달린 모양이 깨지지 않는다. _버린 것_: 목록에서 빼기(답글이 고아가 된다).
- **반응 라벨 · 아이콘은 코드 → 값 맵 prop** — 서버가 종류를 정하므로(설정 한 줄로 늘어난다) 패키지는 종류를 열거하지 않는다. 라벨이 없으면 코드가 글자, 아이콘은 `ReactNode`(장식, `aria-hidden`). _버린 것_: 패키지 안의 `LIKE`/`DISLIKE` 상수와 `switch`(종류를 더할 때마다 패키지를 고쳐야 한다 — 소유자가 정한 방향의 반대) · 서버가 라벨까지 줌(번역 · 문구는 화면의 몫).
- **서버 오류는 화면 문구가 아니라 코드로** — 패키지는 토스트를 모른다: 쓰기 실패는 `ApiRequestError`(`BOARD.*` 코드는 `@skeleton/api-client` 의 `ErrorCodes`)로 앱의 QueryClient 전역 핸들러(`showApiError`)에 간다. 폼은 `PostEditor` 의 `error`(폼 전체) · `fieldErrors`(서버가 칸별로 돌려준 400)를 부모가 채우고, `BoardComments` 의 폼은 실패해도 쓴 글을 지우지 않는다. _버린 것_: 패키지가 영어 오류 문구를 직접 그림(서버 문구는 영어 · 화면이 고를 문구와 다르다).
- **글 id 는 `number`** — 서버 `Long` 이 JSON 숫자로 온다. 문자열로 바꾸면 비교 · 키가 어긋나는 곳이 생겨 그대로 둔다(주소의 `:id` 는 앱이 `Number()`).
