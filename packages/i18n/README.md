# @skeleton/i18n

화면 문구 i18n — **ICU 메시지**(`intl-messageformat`: 복수형 · 선택 · 숫자/날짜 · 문구 안의 태그) · 언어 감지(저장한 선택 → 브라우저 → 기본) · 저장 · 지연 사전 · 서버 렌더 안전. 백엔드 모듈이 아니라 화면 전용이다(서버 메시지는 백엔드 몫).
의존: `intl-messageformat` · `@formatjs/icu-messageformat-parser`(테스트 도구만). peer: `react`.

## 쓰는 법

사전은 **평평한 키**(`section.name`) → ICU 메시지. 기본 언어의 사전이 키 타입의 출처다 — 번역은 같은 키를 가진다(컴파일러 + 짝 맞춤 테스트가 막는다).

```ts
// src/i18n/ko.ts — 기본 언어는 객체(빠진 키의 대체 문구라 늦게 올 수 없다)
export default {
  'inbox.title': '받은편지함',
  'inbox.count': '{count, plural, =0 {새 메일이 없어요} other {새 메일 #통}}',
  'inbox.hint': '<b>{name}</b>님, <link>메일 확인하기</link>',
} as const

// src/i18n/en.ts — `Record<keyof typeof ko, string>` 로 키를 컴파일 시점에 맞춘다
import type ko from './ko'
const en: Record<keyof typeof ko, string> = { … }
export default en

// src/i18n/index.ts — 앱이 한 번 만든다(모듈 전역 싱글턴이 아니라 앱의 인스턴스)
import { createI18n } from '@skeleton/i18n'
import ko from './ko'

export const i18n = createI18n({
  catalogs: { ko, en: () => import('./en') }, // 함수면 지연 로딩(`{ default }` 모듈 그대로)
  defaultLocale: 'ko',
  storageKey: 'myapp:ui-locale', // 사용자가 직접 고른 언어만 여기 저장한다
})
export type MessageKey = Parameters<typeof i18n.t>[0]
```

```tsx
// 앱 시작(SPA) — 렌더 전에 한 번: 저장한 선택 → navigator.languages → 기본 언어, 사전을 불러온 뒤 그린다(깜박임 없음)
await i18n.init()
createRoot(…).render(<I18nProvider i18n={i18n}>…</I18nProvider>)

// 컴포넌트
const { t, tRich, locale, localeOptions, setLocale } = useT<MessageKey>()
t('inbox.count', { count: 3 })
tRich('inbox.hint', { name, b: (c) => <strong>{c}</strong>, link: (c) => <a href="/mail">{c}</a> })
```

- **`t` · `tRich`** — 지금 언어의 문구. 이 언어에 없는 키는 기본 언어 문구, 어디에도 없으면 키(`onMissingKey` 로 알림). 인자를 안 넘기는 등 문구를 못 채우면 화면을 깨지 않고 키를 내보내며 `onError` 로 알린다. 문구 안에 요소가 들어가면 조각을 이어 붙이지 말고 한 문구로 두어 `tRich` 로 — 언어마다 어순이 다르다.
- **`tIn(locale, key)`** — 화면 언어와 다른 언어 문구가 필요할 때(공유 문구 등). 아직 안 불러온 언어면 기본 언어 문구.
- **`setLocale(locale, { remember? })`** — 사전이 도착한 뒤 바꾸고(실패하면 reject + 그대로) 구독 중인 컴포넌트를 그 자리에서 다시 그린다(새로고침 없음 — 입력 중인 값이 남는다). `<html lang>` 을 맞추고 선택을 저장한다(`remember: false` 면 저장 안 함). 늦게 부른 호출이 이긴다.
- **SSR 안전** — 만들 때 `window` · `localStorage` · `navigator` 를 읽지 않는다. 서버와 첫 렌더는 기본 언어. 서버 렌더 앱은 하이드레이션 뒤에 바꾼다: `<I18nProvider i18n detectOnMount>`(요청마다 새 인스턴스를 만들어 준다). 저장소가 막혀도(시크릿 창) 던지지 않는다.
- **`useT()`** 는 `I18nProvider` 의 인스턴스를, `useT(i18n)` 은 넘긴 인스턴스를 쓴다. `localeOptions` 는 자기 말로 쓴 이름(`한국어` · `English`, `Intl.DisplayNames`).

## `@skeleton/ui` · 다른 패키지에 번역된 라벨 먹이기

`@skeleton/*` 부품은 i18n 을 **모른다** — 사용자에게 보이는 글자는 전부 prop(기본 영어)이다. 앱이 번역해 넘긴다. 부품이 새 언어를 알아야 할 일은 없다.

```tsx
const { t, locale, localeOptions, setLocale } = useT<MessageKey>()
<Button loading={saving} loadingLabel={t('common.saving')}>{t('common.save')}</Button>
<Pagination label={t('list.pagination')} previousLabel={t('list.previous')} nextLabel={t('list.next')} … />
<ErrorReference label={t('error.reference')} copyLabel={t('common.copy')} copiedLabel={t('common.copied')} error={error} />
<LanguageMenu label={t('language.label')} value={locale} options={localeOptions} onChange={(next) => void setLocale(next as Locale)} />
// 함수 prop 은 ICU 인자로: bellLabel={(unread) => t('header.bell', { unread })}
// React 밖(api 오류 토스트 등)은 인스턴스를 직접: showApiError(error, { messages: { copy: i18n.t('common.copy'), … } })
```

번역 문구를 쓰는 `showApiError` 같은 호출은 **부를 때** `i18n.t(...)` 로 채운다(부르는 시점의 언어). 문구가 많은 화면은 `useT()` 를 한 번 부르는 작은 훅/컴포넌트로 묶는다.

## 카탈로그 짝 맞춤 테스트 — `@skeleton/i18n/testing`

앱이 자기 테스트에서 부른다(런타임 번들에는 안 들어간다). 실패하면 무엇이 어긋났는지가 문장으로 나온다.

```ts
import { catalogProblems } from '@skeleton/i18n/testing'
it('catalogs agree', async () => {
  expect(await catalogProblems({ ko, en: () => import('./en') }, { defaultLocale: 'ko' })).toEqual(
    [],
  )
})
```

검사: 같은 키(빠짐 · 남음) · ICU 로 읽힘 · **인자가 기본 언어와 같음**(번역이 모르는 인자를 쓰면 코드가 안 넘기는 값, 빼면 넘긴 값이 안 보인다 — 한국어 조사처럼 한 언어만 쓰는 인자는 `allowOmittedArgs: true`) · ICU 문법 옆 ASCII 아포스트로피(`'{` 는 인용이라 글이 사라진다 — `’` 를 쓴다) · 빈 문구. `messageArguments(message)` 도 export 한다.

## 공개 표면

| export                                                                                                                                   | 뜻                                                                                                                                      |
| ---------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `createI18n({ catalogs, defaultLocale, storageKey, storage?, languages?, setDocumentLang?, documentElement?, onMissingKey?, onError? })` | 인스턴스 `{ locales, defaultLocale, getLocale, isLoaded, setLocale, preload, detect, init, subscribe, t, tIn, tRich, has, localeName }` |
| `I18nProvider({ i18n, detectOnMount?, children })` · `useT(instance?)`                                                                   | `{ t, tRich, locale, locales, setLocale, localeOptions }` — 언어가 바뀌면 다시 그린다                                                   |
| `detectLocale({ supported, defaultLocale, stored, languages })`                                                                          | 순수 함수(저장 → 브라우저 → 기본, 전체 태그 → 주 태그)                                                                                  |
| `@skeleton/i18n/testing` — `catalogProblems(catalogs, { defaultLocale, allowOmittedArgs? })` · `messageArguments(message)`               | 카탈로그 짝 맞춤 검사                                                                                                                   |

## 일부러 안 한 것

- **번역 파일 형식을 정하지 않는다** — 사전은 `Record<string, string>` 이면 된다(`.ts` · `.json` · 서버에서 받은 것). 중첩 구조 · 키 자동 추출 · 번역 관리 서비스 연동은 없다.
- **언어 코드 목록을 갖지 않는다** — `catalogs` 의 키가 곧 지원 언어다. 서버 쪽 메시지(오류 `title` · `detail`)는 백엔드가 언어를 고르게 하거나 코드(`ErrorCodes`)로 이 사전의 문구를 고른다.
- **ICU 4J 와의 서버 짝은 이 패키지 밖**이다(백엔드 i18n 모듈은 별개).
