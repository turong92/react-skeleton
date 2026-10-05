# @skeleton/captcha-turnstile

Cloudflare Turnstile — 스크립트 로더 · `<Turnstile siteKey onToken />` · 토큰을 요청에 붙이는 헬퍼. 의존 `@skeleton/*` 없음. peer: `react`.

## 어느 백엔드와 짝인가

| 쓰는 것             | 백엔드                                                                                                                                                                                                                                             |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 토큰 검증(재사용)   | `modules/captcha-turnstile` 의 `TurnstileVerifier.verify(token, remoteIp)` — 위젯이 준 토큰(KDoc: `cf-turnstile-response`)을 Cloudflare siteverify 로 검증. `skeleton.captcha-turnstile.{enabled, secret-key, expected-hostname, expected-action}` |
| **HTTP 엔드포인트** | **모듈에 없다.** 앱 컨트롤러(로그인 · 가입 · 폼)가 요청에서 토큰을 꺼내 `verify` 에 넘긴다. 이 패키지의 기본은 위젯이 폼에 넣는 이름과 같은 **본문 필드 `cf-turnstile-response`** 이고, 앱이 다른 곳에서 읽으면 `field` · 헤더 이름을 바꾼다       |
| `action`            | 백엔드 `expected-action` 이 있으면 위젯의 `action` 과 같은 값                                                                                                                                                                                      |

사이트 키(`siteKey`)는 공개값이고, 비밀 키는 백엔드 설정에만 있다. 개발에는 Cloudflare 의 테스트 키(항상 통과 `1x00000000000000000000AA`)를 쓰고, 백엔드 `secret-key` 도 테스트용 `1x0000000000000000000000000000000AA` 를 쓴다.

## 쓰는 법

```tsx
const captcha = useTurnstileToken()

<Turnstile siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY} action="login" {...captcha.widgetProps} />
<Button type="submit" disabled={!captcha.token}>Sign in</Button>

async function submit() {
  try {
    await apiClient.value('/auth/login', { method: 'POST', json: attachTurnstileToken({ email, password }, captcha.token) })
  } catch (error) {
    captcha.reset() // 토큰은 한 번만 쓰인다 — 실패하면 새로 받는다
  }
}
```

백엔드가 꺼져 있으면(`enabled: false`, `TurnstileVerifier` 빈 없음) 앱은 「없으면 통과」로 처리한다 — 프론트는 `siteKey` 가 없을 때 위젯을 그리지 않으면 된다.

## 공개 표면

| export                                                          | 뜻                                                                                                                                                          |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<Turnstile siteKey onToken onExpire onError action theme … />` | 마운트하면 스크립트를 불러 그린다. 서버 렌더는 빈 상자. `ref` 로 `reset()`. `siteKey` · `action` · `theme` … 이 바뀌면 다시 그린다. 콜백은 최신 것이 불린다 |
| `useTurnstileToken()`                                           | `{ token, reset, widgetProps }` — `widgetProps` 를 `<Turnstile>` 에 펼친다                                                                                  |
| `attachTurnstileToken(body, token, { field? })`                 | JSON 본문 → 토큰이 든 새 객체, `FormData` · `URLSearchParams` → 붙여서 그대로. 토큰이 없으면 `TurnstileTokenMissingError`                                   |
| `turnstileHeaders(token, { header? })`                          | 본문 대신 헤더(`CF-Turnstile-Response`)로 보내는 앱용                                                                                                       |
| `loadTurnstile(env?)` · `TURNSTILE_SCRIPT_SRC`                  | 스크립트를 한 번만 불러 `window.turnstile` 을 돌려준다. 실패하면 다음 호출이 다시 시도. `env` 로 `window` · `document` · `src` 를 바꾼다                    |
| `createTurnstileWidget(options)`                                | 위젯 하나의 수명(React 없이). 로드 전에 `destroy` 하면 아무것도 그리지 않는다                                                                               |

## 테스트가 재지 않는 것

로더(스크립트 한 번 · 재시도 · 실패 · 서버 렌더), 위젯 수명(콜백 매핑 · reset · destroy 경합), 토큰 붙이기, 컴포넌트 서버 렌더는 **네트워크 없이 전역을 가짜로 꽂아** 잰다. **재지 않는다**: 진짜 Cloudflare 스크립트 · 챌린지 · 토큰 발급, 브라우저에서 `useEffect` 로 그려지는 것, 서버 쪽 검증. 테스트 키로 브라우저에서 한 번 확인한다(workbench `/packages` 화면).
