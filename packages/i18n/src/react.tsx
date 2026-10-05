import { createContext, useContext, useEffect, useSyncExternalStore, type ReactNode } from 'react'
import type { I18n, MessageValues, RichValues } from './createI18n'

const I18nContext = createContext<I18n | null>(null)

export type I18nProviderProps = {
  i18n: I18n
  /**
   * 마운트하면 저장한 선택 · 브라우저 언어를 따라 바꾼다(`i18n.init()`). SPA 는 렌더 전에 `await i18n.init()` 를 부르면 깜박임이 없다 —
   * 서버 렌더 앱은 첫 렌더가 서버와 같아야 하므로(하이드레이션) 이 옵션으로 하이드레이션 뒤에 바꾼다
   */
  detectOnMount?: boolean
  children: ReactNode
}

/** 인스턴스를 아래 트리에 건넨다 — 모듈 전역을 쓰지 않으니 서버에서 요청마다 다른 인스턴스를 줄 수 있다 */
export function I18nProvider({ i18n, detectOnMount = false, children }: I18nProviderProps) {
  useEffect(() => {
    if (detectOnMount) void i18n.init()
  }, [i18n, detectOnMount])
  return <I18nContext.Provider value={i18n}>{children}</I18nContext.Provider>
}

export type UseT<K extends string = string, L extends string = string> = {
  t: (key: K, values?: MessageValues) => string
  tRich: (key: K, values: RichValues) => ReactNode
  /** 지금 화면 언어 — 메뉴에서 바꾸면 이 훅을 쓰는 컴포넌트가 다시 그려진다 */
  locale: L
  locales: readonly L[]
  setLocale: (locale: L, options?: { remember?: boolean }) => Promise<void>
  /** 언어 메뉴 선택지 — 자기 말로 쓴 이름(`한국어` · `English`) */
  localeOptions: { value: L; label: string }[]
}

/**
 * 문구 · 언어를 구독한다. 인자 없이 쓰면 `I18nProvider` 의 인스턴스, 인스턴스를 넘기면 그것(공급자 없이).
 * 키 타입을 좁히려면 `useT<MessageKey>()` — 앱이 `type MessageKey = Parameters<typeof i18n.t>[0]` 로 만든다.
 */
export function useT<K extends string = string, L extends string = string>(
  instance?: I18n<L, K>,
): UseT<K, L> {
  const fromContext = useContext(I18nContext)
  const i18n = (instance ?? fromContext) as I18n<L, K> | null
  if (!i18n)
    throw new Error(
      'useT needs an <I18nProvider i18n={…}> above it, or the i18n instance as an argument',
    )
  const locale = useSyncExternalStore(i18n.subscribe, i18n.getLocale, i18n.getLocale)
  return {
    t: i18n.t,
    tRich: i18n.tRich,
    locale,
    locales: i18n.locales,
    setLocale: i18n.setLocale,
    localeOptions: i18n.locales.map((value) => ({ value, label: i18n.localeName(value) })),
  }
}
