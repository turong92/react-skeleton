# @skeleton/time

글로벌 시간 처리(백엔드 `modules:time` 짝). `Intl` 만 쓰고 의존성이 없다.

```ts
import { formatInstant, formatDate, formatDual, createServerClock } from '@skeleton/time'
```

| export                                                                           | 뜻                                                                                                 |
| -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `formatInstant(iso, options?)`                                                   | ISO `...Z` 순간을 내 시간대로                                                                      |
| `formatDate('YYYY-MM-DD')`                                                       | 날짜는 시간대 변환 없이 그대로                                                                     |
| `formatDual(zoned)` · `toZonedMoment(...)`                                       | 이벤트 시간대 + 내 시간대(`GMT+9` 표기). DST 틈·중복 정책은 백엔드와 같다                          |
| `formatRelative` · `zoneLabel` · `offsetMinutes` · `userTimeZone` · `userLocale` | 보조                                                                                               |
| `createServerClock()`                                                            | 응답 `Date` 헤더로 서버 시각 보정. `observeDateHeader` 를 api-client 의 `onResponseDate` 에 꽂는다 |
| `defaultZoneOf(country)` · `zonesOf` · `isSingleZone`                            | 국가 → 시간대(`country-zones.ts` 는 생성 파일)                                                     |

`new Date('YYYY-MM-DD')` 는 쓰지 않는다. 카운트다운은 `serverClock.now()`.

```ts
createApiClient({ ..., getTimeZone: userTimeZone, onResponseDate: (d) => serverClock.observeDateHeader(d) })
```

다른 `@skeleton/*` 패키지를 쓰지 않는다 — 폴더만 복사해도 된다.

## 서버 렌더(SSR)

`formatInstant` 등의 기본 시간대 · 로케일은 **보는 기기의 것**이라 서버(보통 UTC · en-US)와 브라우저에서 결과가 다르다. 서버가 그리는 HTML 에 시각을 넣으면 하이드레이션이 어긋난다 — 하이드레이션 뒤(effect)에 그리거나 `{ zone, locale }` 를 명시한다.
