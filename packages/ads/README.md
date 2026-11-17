# @skeleton/ads

웹 보상형 광고(Google Ad Manager GPT rewarded) — 세션 API · GPT 로더 · 소리 없는 가짜 · 동의 → 재생 → 보상 흐름 컨트롤러 · 훅 · 동의 창. 의존 `@skeleton/api-client` · `@skeleton/ui`. peer: `react`.

## 어느 백엔드와 짝인가

| 쓰는 것                                       | 백엔드                                                                                                                                                                                                    |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 세션 열기 · 보상 요청                         | `modules/ads-web-rewarded`(+ 저장소 `modules/ads-web-rewarded-jdbc`). `skeleton.ads-web-rewarded.enabled=true` 일 때만 선다(꺼짐 → 404)                                                                   |
| **HTTP 엔드포인트(모듈이 연다)**              | `POST /api/v1/ads/web-rewarded/sessions`(본문 `{ purpose }`) · `POST /api/v1/ads/web-rewarded/sessions/{sessionId}/grant`. 기본 경로가 이 패키지의 기본값이고, 모듈 경로를 바꾼 앱은 `basePath` 로 바꾼다 |
| 응답 · 오류 계약                              | 모듈 문서 `docs/modules/ads-web-rewarded.md` 와 모듈의 HTTP DTO 가 정본. 이 패키지의 `WebRewardedSession` · `WebRewardedGrant` 는 그 200 `value` 를 그대로 옮긴 것이다                                    |
| 하루 상한(`409 ADS_WEB_REWARDED.DAILY_LIMIT`) | 세션을 열 때 이미 찼으면 광고를 띄우지 않고(보상 요청에서 찼어도) `limited` 로 끝난다. 상한 · 최소 경과 시간 · 보상 처리(`reward-type`: point 면 즉시 지급, 비우면 1회용 `token`)는 서버 설정이다         |

**보상의 근거는 브라우저의 `rewardedSlotGranted` 신호뿐이다**(구글 서명 콜백 없음). 위조를 다 막지 못하므로 서버가 1회용 세션 · 최소 경과 시간 · 계정 · IP 하루 상한으로 남용을 막는다.

## 쓰는 법

```tsx
// 컴포넌트 밖에서 한 번 — useRewardedAd 는 api 가 바뀌면 컨트롤러를 새로 만든다
const adsApi = createWebRewardedApi(apiClient)

function UnlockButton() {
  const ad = useRewardedAd({
    api: adsApi,
    adUnitPath: '/1234567/rewarded', // Ad Manager 의 보상형(rewarded) 광고 단위
    purpose: 'unlock-episode', // 서버가 받는 목적 ^[a-z0-9][a-z0-9._-]{0,63}$
    // 로컬 · 시험: loadGoogletag: createFakeGoogletag().loader   (진짜 GPT 를 싣지 않고 소리도 없다)
  })

  useEffect(() => {
    if (ad.status === 'rewarded') queryClient.invalidateQueries({ queryKey: ['points'] }) // 앱이 자기 쿼리를 무효화한다
  }, [ad.status])

  return (
    <>
      <Button onClick={ad.start} disabled={ad.status !== 'idle'}>
        Watch an ad for 10 points
      </Button>
      <RewardedAdPrompt ad={ad} reward="Watch a short ad to get 10 points." />
    </>
  )
}
```

- `start()` 는 앱의 버튼에서만 부른다. 컨트롤러는 스스로 시작하지 않고, 끝난 뒤에도 다음 광고를 저절로 띄우지 않는다(다시 하려면 사용자가 다시 누른다 — `start()` 는 `idle` · 끝 상태에서만 듣는다).
- 광고가 준비되면(`ready`) `RewardedAdPrompt` 가 받을 보상을 적은 창을 띄운다. **광고는 [Watch] 클릭 핸들러 안에서만 나간다**(`watch()` → `makeRewardedVisible()`). 준비 신호는 첫 클릭보다 늦게 와서 그때는 브라우저의 일시적 사용자 활성이 끝나 있을 수 있기 때문이다. 사용자 활성이 없으면 `watch()` 는 아무것도 하지 않는다.
- 상태: `idle → opening → loading → ready → playing → granting → rewarded`. 끝 상태는 `rewarded` · `forfeited`(보상 신호 없이 닫힘 — 보상을 잃었다) · `unavailable`(광고 없음) · `limited`(하루 상한) · `failed`(`error` 에 원인). `ready` 에서 `cancel()` 하면 `idle`.
- 보상 요청은 세션 하나에 한 번이다(`granted` 가 여러 번 와도 한 번). 닫히면 슬롯을 지운다(`destroySlots`).
- `rewarded` 의 `grant`: 서버가 `reward-type` 을 정했으면 `reward`(`{ type, ref }`)가 차 있고, 정하지 않았으면(토큰 모드) `reward: null` + 1회용 `token` · `tokenExpiresAt` — 앱이 자기 엔드포인트로 그 토큰을 보내 쓴다.
- 문구(`title` · `watchLabel` · `cancelLabel`)는 prop 이고 기본은 영어다. `reward` 는 앱이 채운다.

## 공개 표면

| export                                                                       | 뜻                                                                                                                                                                                                     |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `useRewardedAd({ api, adUnitPath, purpose, loadGoogletag?, isUserActive? })` | `{ status, grant?, error?, start, watch, cancel }`. 컨트롤러는 effect 안에서 만들고 unmount 에 `destroy`. 서버 렌더는 `idle`                                                                           |
| `<RewardedAdPrompt ad reward title? watchLabel? cancelLabel? />`             | `ready` 일 때만 뜨는 동의 창(`@skeleton/ui` `Dialog`). [Watch] → `ad.watch()`, [Not now] · × · Esc → `ad.cancel()`                                                                                     |
| `createRewardedAd(options)`                                                  | 훅 밑의 흐름 컨트롤러(React 없이): `getState` · `subscribe` · `start` · `watch` · `cancel` · `destroy`                                                                                                 |
| `createWebRewardedApi(client, { basePath? })`                                | `openSession(purpose)` · `grant(sessionId)`. 기본 `/ads/web-rewarded`(`/api/v1` 은 클라이언트의 baseUrl)                                                                                               |
| `loadGoogletag(env?)` · `GPT_SCRIPT_SRC`                                     | GPT 스크립트를 한 번만 불러 `window.googletag` 를 돌려준다. 실패하면 다음 호출이 다시 시도, 브라우저가 아니면 거절                                                                                     |
| `createFakeGoogletag({ outcome?, watchMs? })`                                | 가짜. `outcome`: `granted`(기본) · `closed` · `no-fill` · `load-error`, `watchMs` 기본 8000(서버 `min-elapsed` 7초보다 길게). 미디어를 만들지 않아 소리가 없다. `.loader` 를 `loadGoogletag` 에 끼운다 |

## 정책 체크

구글의 「보상을 주는 광고 단위 정책」 · rewarded web 요건. 이 패키지가 지키는 것과 앱이 지킬 것을 나눴다.

| 요건                                                                     | 누가                                                                                                                                                                                                            |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 광고를 띄울 때마다 해야 할 행동과 받을 보상을 미리 알린다                | 패키지: 동의 창이 `reward` 를 보여 준다. 앱: `reward` 에 실제 보상을 정확히 적는다                                                                                                                              |
| 사용자가 그 광고를 직접 고를 때만 띄운다(한 번 동의로 계속 보는 것 금지) | 패키지: 광고마다 `start()` → 동의 → `watch()` 를 거치고, 끝난 뒤 저절로 다시 시작하지 않는다. 앱: `start()` 를 사용자 클릭 밖에서 부르지 않는다                                                                 |
| 자동 연속 재생을 하지 않는다                                             | 패키지: 컨트롤러가 스스로 시작하지 않는다. 앱: `rewarded` 같은 상태가 되면 곧바로 `start()` 를 부르는 효과를 두지 않는다                                                                                        |
| 닫기 · 건너뛰기가 가능해야 한다                                          | 패키지: 동의 창은 [Not now] · × · Esc 로 닫힌다. 광고 자체의 닫기는 GPT 가 그린다                                                                                                                               |
| 보상형이 아닌 광고에 보상 문구를 붙이지 않는다                           | 앱: 이 패키지의 창은 보상형 광고 단위에만 쓴다. 배너 · 전면 광고에 `reward` 문구를 붙이지 않는다                                                                                                                |
| 보상은 반드시 준다                                                       | 패키지: `rewardedSlotGranted` 가 오면 보상 요청을 한 번 보내 `grant` 를 돌려준다. 서버가 하루 상한으로 거절하면 `limited`, 그 밖의 실패는 `failed`(`error` 에 원인). 앱: `rewarded` 에서 자기 데이터를 갱신한다 |
| 뷰포트 meta(`width=device-width, initial-scale=1`)가 있어야 한다         | 앱: `index.html` 에 둔다                                                                                                                                                                                        |
| Ad Manager 의 「Block non-instream video ads」 보호를 꺼야 한다          | 앱(운영): Ad Manager 설정에서 끈다. 켜 두면 보상형 광고가 막힌다                                                                                                                                                |

IP 하루 상한을 믿으려면 서버가 `skeleton.web.client-ip.mode` 를 정해야 한다(정하지 않으면 전달 헤더로 고를 수 있다).

## 테스트가 재지 않는 것

흐름(동의 → 재생 → granted · closed · 광고 없음 · 상한 · 실패) · 보상 요청 1회 · 손짓 없이는 광고를 띄우지 않음 · 끝난 뒤 자동 재시작 없음 · 닫히면 슬롯 삭제는 **가짜 googletag**(미디어 없음, 소리 없음)로 잰다. 스토리 · 테스트 · CI 어디서도 진짜 GPT 를 싣지 않는다. **재지 않는다**: 진짜 GPT 스크립트 · 진짜 광고 · 광고 소리 · 채움률, 브라우저의 실제 사용자 활성 판정(`navigator.userActivation`), 서버의 한도 · 지급. 진짜 광고 단위 확인은 Ad Manager 의 테스트 광고 단위로 브라우저에서 한 번 한다(소리가 난다).
