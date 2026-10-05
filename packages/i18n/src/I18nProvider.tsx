import { useEffect, type ReactNode } from 'react'
import { I18nContext } from './context'
import type { I18n } from './createI18n'

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
