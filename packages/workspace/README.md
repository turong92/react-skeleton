# @skeleton/workspace

워크스페이스(팀) 사용자 화면 — 만들기 · 고르기 · 이름 / 주소 이름 바꾸기 · 멤버 관리(역할 · 내보내기 · 소유권 이전) · 탈퇴. 백엔드 `modules/workspace`(+ `workspace-jdbc`)의 사용자 HTTP 짝이다. **라우터를 모른다** — 앱이 주소의 slug 와 이동 콜백을 넘긴다. 초대 · 수락 화면과 선택 운영 목록(`@skeleton/workspace/admin`)도 같은 패키지다.

## 팀은 주소에서 읽는다

화면 주소는 `/w/<slug>/…` 이다. 팀은 **주소에서만** 읽으므로 탭마다 다른 팀을 열 수 있고 링크를 공유해도 같은 팀이다. 서버로 나가는 요청은 그 팀의 **id** 를 헤더 `X-Workspace-Id` 로 싣는다(서버는 헤더를 믿지 않고 요청마다 멤버십을 확인한다 — 멤버가 아니면 404, 추방 · 역할 변경은 다음 요청부터).

```tsx
// 앱 한 곳에서 한 번 — 이 탭의 「지금 팀」 칸
const current = createCurrentWorkspace()
const workspaceHeaders = createWorkspaceHeaders(current)

// 앱의 api 클라이언트: 인증 헤더 + 팀 헤더(앱 데이터용)
const client = createApiClient({
  baseUrl,
  getAuthHeaders: async () => ({ ...(await authHeaders()), ...workspaceHeaders() }),
})
// 워크스페이스 자기 관리(이 패키지의 api)는 경로에 id 가 있으니 팀 헤더 없는 클라이언트로
const workspaceApi = createWorkspaceApi(clientWithoutWorkspaceHeader)

// 라우트 `/w/:slug/*`
<WorkspaceProvider
  api={workspaceApi}
  slug={slug}
  current={current}
  memory={lastWorkspaceMemory}            // 선택: 「마지막에 쓴 팀」 보관
  onCanonicalSlug={(next) => navigate(`/w/${next}${rest}`, { replace: true })}
>
  <Outlet />                              {/* 풀린 뒤에만 그려진다 */}
</WorkspaceProvider>
```

- **풀린 뒤에만 자식을 그린다.** `GET /workspaces/by-slug/{slug}` 가 오기 전에는 로딩 자리표시, 404(없는 팀 · 멤버 아님 · 닫힘이 모두 같다) 는 「찾을 수 없음」, 그 밖의 실패는 다시 시도. 풀리면 id 를 `current` 에 싣는다(자식의 쿼리가 시작되기 전) — 그래서 자식의 첫 요청에도 헤더가 붙는다.
- **옛 slug** 로 들어와도 풀린다. 받은 `slug` 가 주소와 다르면 `onCanonicalSlug(지금 slug)` 를 한 번 부른다 — 앱이 주소를 **replace** 로 바꾼다. 설정에서 주소 이름을 바꾸면 같은 길로 새 주소가 된다(받은 상세를 새 slug 의 캐시에 미리 넣어 화면이 비지 않는다).
- **「마지막에 쓴 팀」** 은 첫 화면(`/`)에서 어디로 보낼지 정할 때만 쓴다: `createLastWorkspaceMemory(browserLocalStorage(), accountId)` + `pickLandingSlug(workspaces, memory.read())`(기억한 팀이 내 목록에 있으면 그것, 아니면 첫 팀, 팀이 없으면 undefined → 만들기 화면). **주소에 `/w/<slug>` 가 있으면 읽지 않는다.** 로그아웃 때 `forgetLastWorkspace(storage)`.
- **앱 데이터의 캐시 키에는 팀 id 를 넣는다**(`['notes', workspace.id]`). 팀을 바꿔도 이전 팀의 캐시가 섞이지 않게.
- **401** 은 앱의 몫 — 로그인 뒤 원래 `/w/<slug>/…` 로 돌아오게 복귀 주소를 보관한다(`@skeleton/auth` 의 흐름).

## 내보내기

| 내보내기                                                                                                                                         | 하는 일                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `createWorkspaceApi(client, { basePath? })`                                                                                                      | `GET /workspaces` · `POST` `{name, slug?}` · `GET /{id}` · `GET /by-slug/{slug}` · `PATCH /{id}` `{name?, slug?}` · `GET /{id}/members` · `PATCH /{id}/members/{accountId}` `{role}` · `DELETE …` · `POST /{id}/leave` · `POST /{id}/transfer` `{accountId}`                                                                                                                      |
| `useWorkspaces` · `useWorkspaceBySlug` · `useWorkspaceMembers`                                                                                   | 내 팀 목록 · 주소의 slug 풀기(404 는 조용히 · 재시도 없음) · 멤버                                                                                                                                                                                                                                                                                                                 |
| `useCreateWorkspace` · `useUpdateWorkspace` · `useSetMemberRole` · `useRemoveMember` · `useTransferOwnership` · `useLeaveWorkspace`              | 변경(캐시 무효화는 훅 안에서). 탈퇴는 목록만 다시 가져온다 — 이 팀을 무효화하면 404 가 번쩍인다                                                                                                                                                                                                                                                                                   |
| `WorkspaceProvider` · `useWorkspace()`                                                                                                           | 위. `useWorkspace()` 는 Provider 안에서는 풀린 상세(`id · name · slug · role · memberCount …`), 밖에서는 null                                                                                                                                                                                                                                                                     |
| `createCurrentWorkspace()` · `createWorkspaceHeaders(current)` · `WORKSPACE_HEADER`                                                              | 이 탭의 지금 팀 칸 · `() => ({ 'X-Workspace-Id': id })`(팀이 풀리기 전에는 `{}`)                                                                                                                                                                                                                                                                                                  |
| `createLastWorkspaceMemory(storage, accountId)` · `forgetLastWorkspace(storage)` · `pickLandingSlug(list, remembered)` · `browserLocalStorage()` | 첫 화면용 기억                                                                                                                                                                                                                                                                                                                                                                    |
| `WorkspaceSwitcher { api, currentSlug?, onSelect, onCreate? }`                                                                                   | 머리줄: 지금 팀 이름 단추 → 내 팀(지금 팀에 ✓) + 「새 워크스페이스」                                                                                                                                                                                                                                                                                                              |
| `CreateWorkspaceForm { api, onCreated, onCancel? }`                                                                                              | 이름 + 주소 이름(이름에서 제안, 영문이 아니면 비워 서버가 정한다), 겹침은 칸에서 말한다                                                                                                                                                                                                                                                                                           |
| `WorkspaceSettings { api, workspace, accountId, onLeft }`                                                                                        | 이름 · 주소 이름(ADMIN 이상) · 멤버 표(소유자: 역할 고르기 · 내보내기 · 소유권 이전, 관리자: 멤버 내보내기) · 탈퇴(소유자는 먼저 이전하라는 안내)                                                                                                                                                                                                                                 |
| `WorkspaceInvitations { api, workspace }`                                                                                                        | 사람 초대하기: 주소 여러 개(쉼표 · 공백 · 줄바꿈, **한 번에 20개**) → 주소마다 `invited` / `alreadyInvited` / `seatLimited` 를 보여 준다. 좌석 상한이 있으면 `n / 상한`(멤버 + 기다리는 초대), 다 찼으면 보내지 못한다. 기다리는 초대 표: 만료 표시 · 재발송(429 `RESEND_TOO_SOON` 은 기다릴 초를 안내) · 취소. ADMIN 이상에게만 그려진다(관리자는 멤버로만, 소유자는 관리자로도) |
| `AcceptInvitation { api, signedIn, onSignIn, onAccepted, onGoHome? }`                                                                            | `/invite` 화면. 토큰을 읽어 **이 탭 저장소에 두고 주소창에서 지운다** → 미리보기 → 로그인 전 「로그인 · 가입 후 수락」(`onSignIn`) → 돌아와 「초대 수락」 → `onAccepted(workspace)` 에서 앱이 `/w/<slug>` 로 이동                                                                                                                                                                 |
| `parseInviteEmails` · `seatUsage` · `canInvite` · `invitableRoles` · `invitationProblem` · `takeInvitationToken` · `createInvitationTokenStore`  | 입력 글 → 주소들 · 좌석 계산 · 단추 규칙 · 초대 오류 한 낱말(`expired` / `used` / `invalid` / `emailMismatch` …) · 주소창 토큰 옮기기                                                                                                                                                                                                                                             |
| `@skeleton/workspace/admin`: `createWorkspaceAdminApi` · `AdminWorkspaces { api, can? }`                                                         | 운영자 목록(이름 · 소유자 · 멤버 수 · 상태 · 만든 때), 검색, 「더 보기」(커서), 상세(멤버 표 · 기다리는 초대 수). **읽기만**. `can('workspace.read')` 가 거짓이면 안내만                                                                                                                                                                                                          |
| `memberActions` · `canManageWorkspace` · `roleAtLeast` · `slugProblem` · `slugFromName` · `workspaceProblem`                                     | 단추 숨김 규칙 · 주소 이름 검사 · 오류 한 낱말                                                                                                                                                                                                                                                                                                                                    |
| `koWorkspaceLabels` · `defaultWorkspaceLabels` · `resolveWorkspaceLabels`                                                                        | 문구(영어 기본 · 한국어 · 일부만 바꾸기) — 부품은 `labels` prop                                                                                                                                                                                                                                                                                                                   |

## 지켜야 할 것

- **단추는 역할로 숨기지만 검사는 서버가 한다**(`WORKSPACE.FORBIDDEN` 403). 계정 id 는 화면 어디에도 그리지 않는다(`label` 이 없으면 「이름 없는 멤버」).
- **워크스페이스 관리 호출(이 패키지의 api)은 `X-Workspace-Id` 없는 클라이언트로 만든다.** 서버가 헤더를 붙은 모든 요청에서 멤버십을 확인한다면, 추방된 직후 남은 헤더 때문에 목록 · 풀기 호출이 404 를 받을 수 있다. 앱 데이터 호출만 팀 헤더를 합친다.
- 주소 이름 규칙은 서버와 같다: 3~40자, 소문자 · 숫자 · 하이픈, 앞뒤 하이픈 없음. 옛 주소 이름은 다른 팀이 가져가지 못한다(서버).
- 계약에서 본문이 정해지지 않은 곳은 이렇게 가정했다: `POST /workspaces` 는 `{id, name, slug, role}`(목록 한 줄과 같다)를 돌려주고, `PATCH /workspaces/{id}` 는 상세를 돌려주며, 멤버 `PATCH` · `DELETE` · `leave` · `transfer` 는 본문이 필요 없다(204 든 200 이든 무시). 서버가 다르면 `types.ts` · `workspaceApi.ts` 를 맞춘다.
- **초대 링크 흐름**: 서버가 메일에 `<link-base-url>/invite?token=…` 를 싣는다. 앱은 `/invite` 라우트에 `AcceptInvitation` 을 놓고 `signedIn` · `onSignIn`(로그인/가입 화면으로 — 토큰은 이 탭에 남는다) · `onAccepted`(`navigate('/w/'+slug)`) 를 준다. 토큰은 주소가 아니라 **본문**으로 서버에 가고(접근 로그에 안 남게), 쓰였거나 죽은 토큰은 탭에서 지운다. 주소가 다른 계정으로 로그인했을 때는 토큰을 지우지 않는다(계정을 바꿔 돌아오면 이어서 수락).
- 계약에서 본문이 정해지지 않은 초대 쪽 가정: `accept` 는 들어간 워크스페이스를 `{id, name, slug, role}`(목록 한 줄과 같다)로 돌려주고, 재발송 · 취소는 본문이 필요 없다. 죽은 토큰의 이유는 오류 본문의 `data.reason`(`EXPIRED` | `USED` | `INVALID`)에서 읽는다(없으면 `detail` 글자도 본다). 서버가 다르면 `types.ts` · `workspaceApi.ts` · `errors.ts` 를 맞춘다.
- 스토리: `WorkspaceInvitations` · `AcceptInvitation`(세 상태 + 오류 코드별) · `admin/AdminWorkspaces`, `WorkspaceSwitcher` · `CreateWorkspaceForm` · `WorkspaceProvider`(헤더 순서 · 옛 주소 · 멤버 아님) · `WorkspaceSettings`(역할별 단추 · 역할 바꾸기 · 내보내기 · 이전 · 탈퇴 · 주소 바꾸기), 가짜 서버는 `src/stories/fakeWorkspaces.ts`.
