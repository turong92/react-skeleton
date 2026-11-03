# @skeleton/waiting-room

대기열(가상 대기실) 사용자 화면 — 백엔드 `modules/waiting-room`(+ `waiting-room-jdbc`)의 짝. 인기 있는 일(예약 오픈)을 앞에서 줄 세워 받는다. **로그인한 사람만** 줄을 서고(계정 하나에 순번표 하나), 순번표 · 입장권은 서버가 서명한 토큰이다.

| 내보내기                                                                        | 하는 일                                                                                                                                                                                                             |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `createWaitingRoomApi(client, { basePath? })`                                   | `takeTicket(roomId)` → `POST /waiting-rooms/{id}/tickets` · `status(roomId, ticketToken)` → `GET …/status`(헤더 `X-Ticket`). 기본 경로 `/api/v1/waiting-rooms`                                                      |
| `useWaitingRoom(roomId, { api, storage?, autoJoin? })`                          | 줄 서기 · 서버가 정한 간격(`pollAfterSeconds`)으로 묻기 · `status` · `enter()`(입장권을 기다렸다 문자열로 돌려준다, 닫힘 / 입장 시간 끝이면 `WaitingRoomEntryError`) · `rejoin()`(입장 시간이 끝난 뒤 다시 줄 서기) |
| `WaitingRoomGate`                                                               | **페이지 앞 문** — 입장하기 전엔 `WaitingScreen`, 입장하면 `children`(`useWaitingRoomEntry()` 로 입장권). 입장 시간이 끝나도 children 은 그대로 두고 입장권만 거둔다(하던 일을 마칠 수 있게) + 「다시 줄 서기」 띠  |
| `WaitingScreen`                                                                 | 대기 화면 — 오픈 카운트다운 · 「내 앞에 N명」 · 예상 시간 · 진행 막대 · 「새로고침해도 순서는 그대로예요」 · 입장 시간 끝 · 닫힘                                                                                    |
| `createEntryHeaders(entryToken)`                                                | `{ 'X-Entry-Token': token }` — 입장권이 필요한 요청(자리 더하기 …)에 붙인다. 토큰이 없으면 `{}`                                                                                                                     |
| `defaultWaitingRoomLabels` · `koWaitingRoomLabels` · `resolveWaitingRoomLabels` | 문구(영어 기본 · 한국어)                                                                                                                                                                                            |
| `@skeleton/waiting-room/admin`                                                  | `createWaitingRoomAdminApi` · `AdminWaitingRoom`(분당 입장 수 · 멈춤 / 다시 시작 · 닫기 · 숫자 현황 5초 갱신) · 문구                                                                                                |

```tsx
const waitingRoomApi = createWaitingRoomApi(apiClient)

// 페이지 앞 — 오픈 전 줄부터 입장까지를 이 문이 맡는다
<WaitingRoomGate api={waitingRoomApi} roomId={pool.waitingRoomId} labels={koWaitingRoomLabels}>
  <SeatPage />
</WaitingRoomGate>

// 자리를 더하는 요청마다 입장권을 헤더로
const { entryToken } = useWaitingRoomEntry()
apiClient.value('/booking/pools/p1/hold/seats', { method: 'POST', json: { seatIds }, headers: createEntryHeaders(entryToken) })

// 버튼 앞 — 눌렀을 때만 줄을 선다
const room = useWaitingRoom(roomId, { api: waitingRoomApi })
const token = await room.enter() // 입장하면 돌려준다
{room.started && room.status?.state !== 'ADMITTED' && <WaitingScreen status={room.status} failed={room.error !== null} onRejoin={room.rejoin} />}
```

- 순번표는 방별로 `sessionStorage` 에 둔다(새로고침해도 순서 그대로). 저장소를 못 쓰거나 서버가 거절한 순번표(다른 계정이 쓰던 것 …)는 버리고 새로 받는다 — 지워져도 다시 받으면 같은 순번표다. **입장권은 저장하지 않는다**(메모리에만).
- 묻는 간격은 서버 값 그대로(1초 미만이면 1초) — 앞 사람 수로 5 ~ 30초. 입장해도 계속 물어 입장 시간이 끝나는 것을 안다. `CLOSED` · `EXPIRED` 가 되면 더 묻지 않는다. 네트워크 오류 · 5xx 는 10초 뒤 다시(화면에는 「다시 시도하는 중」 띠).
- 오픈 카운트다운은 브라우저 시계로 센다. 상태는 서버가 말한다(시계가 틀려도 입장은 서버가 정한다).
- 운영 화면은 서버의 `skeleton.waiting-room.admin.enabled` 와 `waiting-room.manage` 권한이 있어야 열린다. 대기실 만들기(`POST /admin/waiting-rooms`)는 이 패키지에 화면이 없다.
- 스토리: `Packages/waiting-room/WaitingScreen` · `Packages/waiting-room/WaitingRoomGate` · `Packages/waiting-room/admin/AdminWaitingRoom`.
