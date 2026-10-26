import type { ConsentStore } from '../consent/consentStore'

/*
 * 분석 코드 로더 - **동의 전에는 아무것도 보내지 않는다**. GA(gtag)는 동의 범주가 켜진 뒤에야 스크립트를 붙이고,
 * 끄면 `gtag('consent','update',{ analytics_storage: 'denied' })` 로 멈춘다. Cloudflare Web Analytics 비콘은 쿠키가 없어 동의와 무관하게 토큰이 있으면 붙인다.
 * 부수 효과는 `start()` 를 부를 때만(import 만으로는 아무 일도 없다 - 서버 렌더 안전).
 */

type ScriptNode = {
  src: string
  async: boolean
  defer: boolean
  dataset: Record<string, string>
  setAttribute?(name: string, value: string): void
}
/** 로더가 쓰는 문서의 부분(시험에서 가짜를 꽂는다) */
export type DocumentLike = {
  head: { appendChild(node: ScriptNode): unknown }
  createElement(tag: 'script'): ScriptNode
}
export type WindowLike = { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void }

export type AnalyticsLoaderOptions = {
  consent: Pick<ConsentStore, 'has' | 'subscribe'>
  /** GA4 측정 ID(`G-XXXX`). 없으면 동의해도 GA 는 붙지 않는다 */
  gaMeasurementId?: string
  /** Cloudflare Web Analytics 비콘 토큰. 없으면 붙이지 않는다 */
  cfBeaconToken?: string
  /** GA 를 켜는 동의 범주(기본 `analytics`) */
  category?: string
  document?: DocumentLike
  window?: WindowLike
}

export type AnalyticsLoader = {
  /** 동의 상태를 따라 켜고 끈다. 돌려주는 함수가 구독을 푼다. DOM 이 없으면(서버) 아무것도 하지 않는다 */
  start(): () => void
}

const GA_ID = /^G-[A-Z0-9]{4,}$/
const CF_TOKEN = /^[A-Za-z0-9]{8,}$/
export const GTAG_URL = 'https://www.googletagmanager.com/gtag/js'
export const CF_BEACON_URL = 'https://static.cloudflareinsights.com/beacon.min.js'

export function createAnalyticsLoader({
  consent,
  gaMeasurementId,
  cfBeaconToken,
  category = 'analytics',
  document: doc = typeof document === 'undefined'
    ? undefined
    : (document as unknown as DocumentLike),
  window: win = typeof window === 'undefined' ? undefined : (window as unknown as WindowLike),
}: AnalyticsLoaderOptions): AnalyticsLoader {
  const gaId = gaMeasurementId && GA_ID.test(gaMeasurementId) ? gaMeasurementId : undefined
  const cfToken = cfBeaconToken && CF_TOKEN.test(cfBeaconToken) ? cfBeaconToken : undefined
  let gaLoaded = false
  let cfLoaded = false

  function gtag(...args: unknown[]) {
    if (!win) return
    // gtag.js 는 `arguments` 객체를 기다린다(배열이 아니다)
    win.dataLayer ??= []
    win.dataLayer.push(args)
  }

  function loadGa() {
    if (!doc || !win || !gaId) return
    if (gaLoaded) {
      gtag('consent', 'update', { analytics_storage: 'granted' })
      return
    }
    gaLoaded = true
    win.dataLayer ??= []
    win.gtag = (...args: unknown[]) => {
      win.dataLayer!.push(args)
    }
    gtag('js', new Date())
    gtag('config', gaId)
    const script = doc.createElement('script')
    script.async = true
    script.src = `${GTAG_URL}?id=${encodeURIComponent(gaId)}`
    doc.head.appendChild(script)
  }

  function loadBeacon() {
    if (!doc || !cfToken || cfLoaded) return
    cfLoaded = true
    const script = doc.createElement('script')
    script.defer = true
    script.src = CF_BEACON_URL
    script.dataset.cfBeacon = JSON.stringify({ token: cfToken })
    doc.head.appendChild(script)
  }

  function apply() {
    if (consent.has(category)) loadGa()
    else if (gaLoaded) gtag('consent', 'update', { analytics_storage: 'denied' })
  }

  return {
    start() {
      if (!doc || !win) return () => {}
      loadBeacon()
      apply()
      return consent.subscribe(apply)
    },
  }
}
