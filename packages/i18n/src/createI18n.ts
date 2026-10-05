import { IntlMessageFormat, type PrimitiveType } from 'intl-messageformat'
import { createElement, Fragment, type ReactNode } from 'react'
import { detectLocale } from './detectLocale'

/** 키 → ICU 메시지. 키는 `section.name` 처럼 점으로 묶는 것을 권한다(평평한 사전) */
export type Messages = Record<string, string>
/** 동적 import 를 그대로 — `() => import('./en')` (모듈의 `default` 가 사전이어도 된다) */
export type CatalogLoader = () => Promise<Messages | { default: Messages }>
export type CatalogSource = Messages | CatalogLoader

export type MessageValues = Record<string, PrimitiveType>
export type RichValues = Record<
  string,
  PrimitiveType | ReactNode | ((chunks: ReactNode[]) => ReactNode)
>

export type StorageLike = {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export type I18nOptions<C extends Record<string, CatalogSource>, D extends keyof C & string> = {
  /** 언어 → 사전(또는 사전을 불러오는 함수). 기본 언어의 것은 객체여야 한다 — 빠진 키의 대체 문구라 늦게 올 수 없다 */
  catalogs: C
  defaultLocale: D
  /** 사용자가 고른 언어를 저장하는 localStorage 키(앱이 정한다 — 예 `myapp:ui-locale`) */
  storageKey: string
  /** 저장소(기본 `localStorage`, 접근은 처음 쓸 때). `null` 이면 저장하지 않는다 */
  storage?: StorageLike | null
  /** 브라우저 언어 목록(기본 `navigator.languages`) — 테스트 · 서버에서 갈아 끼운다 */
  languages?: () => readonly string[]
  /** 언어를 바꾸면 `<html lang>` 도 바꾼다(기본 true) */
  setDocumentLang?: boolean
  /** `lang` 을 달 요소(기본 `document.documentElement`, 없으면 건너뛴다) */
  documentElement?: () => { lang: string } | null
  /** 어느 언어에도 없는 키를 불렀을 때(언어 · 키마다 한 번) — 개발 중 경고 자리 */
  onMissingKey?: (info: { locale: string; key: string }) => void
  /** 문구를 채우다 실패했을 때(필요한 인자를 안 넘김 등). 화면에는 키가 나간다 */
  onError?: (info: { locale: string; key: string; error: unknown }) => void
}

/** 기본 언어 사전의 키 — 기본 언어가 객체일 때 `t('…')` 의 자동완성 · 오타 검사가 된다 */
export type KeyOf<S> = S extends CatalogLoader
  ? never
  : S extends Messages
    ? keyof S & string
    : never
type KeysOf<C extends Record<string, CatalogSource>, D extends keyof C> = [KeyOf<C[D]>] extends [
  never,
]
  ? string
  : KeyOf<C[D]>

export type I18n<L extends string = string, K extends string = string> = {
  readonly locales: readonly L[]
  readonly defaultLocale: L
  /** 지금 화면 언어. 서버 · 첫 렌더는 기본 언어다(`init()` 전까지) */
  getLocale(): L
  isLoaded(locale: L): boolean
  /**
   * 언어를 바꾼다. 지연 사전이면 도착한 뒤에 바뀐다(그 전까지 화면은 지금 언어 그대로). 불러오기가 실패하면 reject 하고 그대로다.
   * `remember: false` 는 저장하지 않는다(테스트 · 미리보기). 바뀌면 구독자에게 알리고 `<html lang>` 을 맞춘다
   */
  setLocale(locale: L, options?: { remember?: boolean }): Promise<void>
  /** 사전만 미리 불러 둔다(메뉴에 올렸을 때 등) */
  preload(locale: L): Promise<void>
  /** 저장한 선택 → 브라우저 언어 → 기본 언어. 읽기만 한다 */
  detect(): L
  /** `detect()` 한 언어로 바꾼다(저장하지 않는다 — 직접 고른 것만 기억). 앱 시작 때 한 번, 브라우저에서만 부른다 */
  init(): Promise<L>
  /** React `useSyncExternalStore` 용 */
  subscribe(listener: () => void): () => void
  /** 지금 언어의 문구. 이 언어에 없으면 기본 언어 문구, 거기도 없으면 키 */
  t(key: K, values?: MessageValues): string
  /** 정한 언어의 문구(공유 문구처럼 화면 언어와 다른 언어가 필요할 때). 아직 안 불러온 언어면 기본 언어 문구 */
  tIn(locale: L, key: K, values?: MessageValues): string
  /** 문구 안에 요소가 들어갈 때 — `<b>굵게</b>` 의 `b` 를 함수로 넘긴다. 조각을 이어 붙이지 않고 한 문구로 두어야 언어마다 어순이 바뀐다 */
  tRich(key: K, values: RichValues): ReactNode
  has(key: string): key is K
  /** 그 언어를 자기 말로 쓴 이름(한국어 · English) — 언어 메뉴의 선택지. 못 읽는 사람에게 못 읽는 글로 안내하지 않는다 */
  localeName(locale: L): string
}

const unwrap = (loaded: Messages | { default: Messages }): Messages =>
  'default' in loaded && typeof loaded.default === 'object' ? loaded.default : (loaded as Messages)

function defaultStorage(): StorageLike | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null // 저장소 접근 자체가 막힌 환경
  }
}

function defaultLanguages(): readonly string[] {
  if (typeof navigator === 'undefined') return []
  return navigator.languages?.length
    ? navigator.languages
    : navigator.language
      ? [navigator.language]
      : []
}

function defaultDocumentElement(): { lang: string } | null {
  return typeof document === 'undefined' ? null : document.documentElement
}

/**
 * i18n 인스턴스 하나 — 모듈 전역 싱글턴이 아니라 앱이 만든다(`src/i18n.ts` 에서 한 번). 만들 때는 브라우저 API 를 읽지 않는다 —
 * 서버 · 첫 렌더는 기본 언어이고, 브라우저가 `init()` 으로 저장한 선택 · 브라우저 언어를 따른다.
 */
export function createI18n<C extends Record<string, CatalogSource>, D extends keyof C & string>(
  options: I18nOptions<C, D>,
): I18n<keyof C & string, KeysOf<C, D>> {
  type L = keyof C & string
  type K = KeysOf<C, D>
  const locales = Object.keys(options.catalogs) as L[]
  const defaultLocale: L = options.defaultLocale
  const defaultSource = options.catalogs[defaultLocale]
  if (typeof defaultSource !== 'object' || defaultSource === null)
    throw new TypeError(
      `i18n: the default locale "${defaultLocale}" must be an object catalog, not a loader (it is the fallback for missing keys)`,
    )

  const loaded = new Map<L, Messages>([[defaultLocale, defaultSource]])
  for (const locale of locales) {
    const source = options.catalogs[locale]
    if (typeof source === 'object') loaded.set(locale, source)
  }
  const loading = new Map<L, Promise<Messages>>()
  const listeners = new Set<() => void>()
  const formatters = new Map<string, IntlMessageFormat>()
  const reported = new Set<string>()
  let current: L = defaultLocale
  let request = 0

  const isSupported = (value: string): value is L => (locales as string[]).includes(value)

  function load(locale: L): Promise<Messages> {
    const have = loaded.get(locale)
    if (have) return Promise.resolve(have)
    const pending = loading.get(locale)
    if (pending) return pending
    const source = options.catalogs[locale] as CatalogLoader
    const promise = source().then(
      (result) => {
        const messages = unwrap(result)
        loaded.set(locale, messages)
        loading.delete(locale)
        return messages
      },
      (error: unknown) => {
        loading.delete(locale) // 다시 시도할 수 있게
        throw error
      },
    )
    loading.set(locale, promise)
    return promise
  }

  function missing(locale: string, key: string) {
    const id = `${locale}\u0000${key}`
    if (reported.has(id)) return
    reported.add(id)
    options.onMissingKey?.({ locale, key })
  }

  function formatter(locale: L, key: string): IntlMessageFormat | null {
    const own = loaded.get(locale)?.[key]
    // 이 언어에 없으면 기본 언어 문구 — 키 이름이 화면에 보이는 것보다 낫다. 짝 맞춤 테스트(@skeleton/i18n/testing)가 CI 에서 막는다
    const from = own !== undefined ? locale : defaultLocale
    const message = own ?? (defaultSource as Messages)[key]
    if (message === undefined) {
      missing(locale, key)
      return null
    }
    const id = `${from}\u0000${key}`
    const hit = formatters.get(id)
    if (hit) return hit
    const created = new IntlMessageFormat(message, from)
    formatters.set(id, created)
    return created
  }

  function format<T>(locale: L, key: string, values: unknown, rich: boolean): T | string {
    try {
      const f = formatter(locale, key)
      if (!f) return key
      const out = f.format(values as never)
      return (rich ? out : String(out)) as T
    } catch (error) {
      options.onError?.({ locale, key, error })
      return key
    }
  }

  function applyDocumentLang(locale: L) {
    if (options.setDocumentLang === false) return
    const root = (options.documentElement ?? defaultDocumentElement)()
    if (root) root.lang = locale
  }

  function readStored(): string | null {
    try {
      const storage = options.storage === undefined ? defaultStorage() : options.storage
      return storage?.getItem(options.storageKey) ?? null
    } catch {
      return null // 시크릿 창 · 저장 차단
    }
  }

  function writeStored(locale: L) {
    try {
      const storage = options.storage === undefined ? defaultStorage() : options.storage
      storage?.setItem(options.storageKey, locale)
    } catch {
      // 저장만 못 한다 — 이번 탭에서는 고른 언어가 유지된다
    }
  }

  function detect(): L {
    return detectLocale({
      supported: locales,
      defaultLocale,
      stored: readStored(),
      languages: (options.languages ?? defaultLanguages)(),
    })
  }

  async function setLocale(locale: L, opts: { remember?: boolean } = {}): Promise<void> {
    if (!isSupported(locale)) throw new RangeError(`i18n: unknown locale "${String(locale)}"`)
    const id = ++request
    await load(locale)
    if (id !== request) return // 더 나중에 부른 setLocale 이 이긴다
    if (opts.remember ?? true) writeStored(locale)
    applyDocumentLang(locale)
    if (locale === current) return
    current = locale
    listeners.forEach((listener) => listener())
  }

  return {
    locales,
    defaultLocale,
    getLocale: () => current,
    isLoaded: (locale) => loaded.has(locale),
    setLocale,
    preload: async (locale) => {
      await load(locale)
    },
    detect,
    async init() {
      const locale = detect()
      await setLocale(locale, { remember: false })
      return locale
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    t: (key, values) => format<string>(current, key, values, false) as string,
    tIn: (locale, key, values) => format<string>(locale, key, values, false) as string,
    tRich(key, values) {
      const out = format<ReactNode>(current, key, values, true)
      return Array.isArray(out) ? createElement(Fragment, null, ...out) : (out as ReactNode)
    },
    has: (key): key is K => key in (defaultSource as Messages),
    localeName(locale) {
      try {
        return new Intl.DisplayNames([locale], { type: 'language' }).of(locale) ?? locale
      } catch {
        return locale
      }
    },
  }
}
