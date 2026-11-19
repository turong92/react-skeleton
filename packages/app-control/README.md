# @skeleton/app-control

재배포 없이 끄고 켜는 것들의 웹 쪽 — **점검 화면** · **기능 스위치 읽기** · **새 버전 안내**. 백엔드 kotlin-skeleton `modules/app-control` 짝이고 겨냥하는 계약은 `docs/app-control-http-contract.md` 의 `GET /api/v1/app/config`(익명 · 점검 중에도 열림)다.

```tsx
const api = createAppControlApi(apiClient)            // 기본 경로 /app/config

<AppControlGate api={api} appVersion={import.meta.env.VITE_APP_RELEASE} labels={koAppControlLabels}>
  <App />
</AppControlGate>

const betaOn = useFeature(api, 'new-checkout')        // 운영자가 클라이언트에 보이기로 한 스위치만 온다
```

| 내보내는 것                                                                | 하는 일                                                                                                                                                         |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `createAppControlApi(client, { basePath? })`                               | `config()` — 설정 한 번 읽기                                                                                                                                    |
| `useAppConfig(api, { maintenancePollMs? })`                                | 창에 돌아오면(30초가 지났으면) 다시 읽고, 점검 중에는 풀릴 때까지 30초마다 읽는다. 못 읽어도 앱은 막히지 않는다                                                 |
| `useFeature(api, key, fallback = false)`                                   | 스위치 하나. 키가 없으면(만든 적 없음 · 아직 못 읽음) `fallback`                                                                                                |
| `appStateOf(config, { appVersion, platform = 'web', dismissed })`          | 지금 올릴 화면 하나 — 점검 > 강제 업데이트 > 권장 업데이트 > 보통. 순수 함수                                                                                    |
| `AppControlGate`                                                           | 앱 맨 위. 점검 화면 · 닫을 수 없는 새로고침 화면 · 닫을 수 있는 띠(닫으면 같은 권장 버전은 다시 안 묻는다). `onUpdate`(기본 새로고침) · `formatTime` · `labels` |
| `isBelow(version, limit)` · `parseVersion`                                 | 버전 비교 — **숫자 칸으로**(`1.9` < `1.10`, `1.2` = `1.2.0`), `+빌드` · `-접미사` 는 뗀다, 읽을 수 없으면 막지 않는다                                           |
| `isMaintenanceError(error)` · `watchMaintenance(queryClient, cb)`          | 503 점검 응답인지 · 어느 호출이든 그 응답을 받으면 부른다                                                                                                       |
| `defaultAppControlLabels` · `koAppControlLabels` · `mergeAppControlLabels` | 문구(기본 영어, 한국어 해요체)                                                                                                                                  |

**웹의 새 버전**: 모바일의 최소 버전 자리에 웹은 `platforms.web` 를 쓴다 — 앱이 자기 버전(`appVersion`, 빌드 때 넣는 상수)을 알고, 배포 스크립트가 배포 뒤 `PATCH /api/v1/admin/app-control/platforms/web {"recommendedVersion":"<새 버전>"}` 를 한 번 부르면 열려 있는 탭이 창에 돌아올 때 닫을 수 있는 새로고침 띠를 본다(`minVersion` 이면 막는 화면). 서버가 말하기 전에는 아무것도 막지 않는다.
**점검**: 어느 API 호출이든 `503 APP_CONTROL.MAINTENANCE`(`Retry-After` 와 안내 문구)를 받을 수 있다 — `AppControlGate` 가 쿼리 · 변경의 그 실패를 보고(`watchMaintenance`, 설정 쿼리 자신은 제외) 설정을 바로 다시 읽어 점검 화면으로 바꾼다. 설정 경로만 점검 중에도 열려 있고, 풀리면 주기적으로 읽다가 돌아온다.
**운영자 화면은 문 밖**: 점검을 끄는 화면이 점검 화면에 가려지면 안 된다 — 운영자 라우트는 `AppControlGate` 밖에 두거나 `bypass` 를 준다(서버도 `/api/v1/admin/**` · 로그인은 점검 중에 통과시킨다).
**모듈이 없는 백엔드**: 401 · 403 · 404 · 405 는 다시 묻지 않고 앱의 전역 오류 토스트도 거른다(`meta.quietStatuses`).
