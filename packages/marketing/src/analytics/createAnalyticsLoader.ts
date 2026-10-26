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
export type WindowLike = {
  dataLayer?: unknown[]
  gtag?: (...args: unknown[]) => void
  location?: { href: string }
}

export type AnalyticsLoaderOptions = {
  consent: Pick<ConsentStore, 'has' | 'subscribe'>
  /** GA4 측정 ID(`G-XXXX`). 없으면 동의해도 GA 는 붙지 않는다 */
  gaMeasurementId?: string
  /** Cloudflare Web Analytics 비콘 토큰. 없으면 붙이지 않는다 */
  cfBeaconToken?: string
  /** GA 를 켜는 동의 범주(기본 `analytics`) */
  category?: string
  /** 페이지 주소에서 GA 로 보내기 전에 뗄 쿼리 이름(메일 링크의 일회용 토큰 · 로그인 콜백 값). 기본 `DEFAULT_REDACTED_PARAMS` */
  redactParams?: readonly string[]
  document?: DocumentLike
  window?: WindowLike
}

export type AnalyticsLoader = {
  /**
   * 라우트가 바뀐 뒤에 부른다 - 동의해 GA 가 붙은 상태일 때만 `page_view` 를 보낸다(주소는 인증 값을 뗀 것, 같은 주소는 다시 보내지 않는다).
   * GA 속성의 「브라우저 기록 이벤트로 페이지 변경 측정」을 켜 두면 gtag 가 스스로도 보내니 하나만 쓴다
   */
  trackPageView(): void
  /** 동의 상태를 따라 켜고 끈다. 돌려주는 함수가 구독을 푼다. DOM 이 없으면(서버) 아무것도 하지 않는다 */
  start(): () => void
}

/** 인증 값이 실린 쿼리 - GA 의 `page_location` 에서 뗀다(메일 링크 `?token=` · 소셜 콜백 `?code=&state=` …) */
export const DEFAULT_REDACTED_PARAMS = [
  'token',
  'code',
  'state',
  'access_token',
  'id_token',
  'refresh_token',
  'key',
  'password',
] as const

/** `href` 에서 민감한 쿼리(와 조각의 같은 이름 값)를 뗀 주소. 주소가 아니면 그대로 */
export function redactedLocation(href: string, params: readonly string[]): string {
  try {
    const url = new URL(href)
    for (const name of params) url.searchParams.delete(name)
    if (url.hash.includes('=')) {
      const fragment = new URLSearchParams(url.hash.slice(1))
      for (const name of params) fragment.delete(name)
      const rest = fragment.toString()
      url.hash = rest ? `#${rest}` : ''
    }
    return url.toString()
  } catch {
    return href
  }
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
  redactParams = DEFAULT_REDACTED_PARAMS,
  document: doc = typeof document === 'undefined'
    ? undefined
    : (document as unknown as DocumentLike),
  window: win = typeof window === 'undefined' ? undefined : (window as unknown as WindowLike),
}: AnalyticsLoaderOptions): AnalyticsLoader {
  const gaId = gaMeasurementId && GA_ID.test(gaMeasurementId) ? gaMeasurementId : undefined
  const cfToken = cfBeaconToken && CF_TOKEN.test(cfBeaconToken) ? cfBeaconToken : undefined
  let gaLoaded = false
  let cfLoaded = false

  /**
   * gtag.js 는 `dataLayer` 에 **`arguments` 객체**가 들어와야 명령으로 읽는다(배열은 GTM 식 이벤트로 읽혀 `config` · `consent` 가 먹지 않는다) -
   * 공식 스니펫의 `function gtag(){ dataLayer.push(arguments) }` 와 같은 꼴이어야 해서 일반 함수다.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- 선언한 인자는 호출 쪽 타입을 위한 것 - 값은 `arguments` 로 읽는다
  function gtag(..._declared: unknown[]) {
    if (!win) return
    win.dataLayer ??= []
    // eslint-disable-next-line prefer-rest-params -- `arguments` 객체여야 gtag.js 가 읽는다
    win.dataLayer.push(arguments)
  }

  let lastPageView: string | null = null
  function sendPageView() {
    if (!win?.location) return
    const location = redactedLocation(win.location.href, redactParams)
    if (location === lastPageView) return
    lastPageView = location
    gtag('event', 'page_view', { page_location: location })
  }

  function loadGa() {
    if (!doc || !win || !gaId) return
    if (gaLoaded) {
      gtag('consent', 'update', { analytics_storage: 'granted' })
      return
    }
    gaLoaded = true
    win.dataLayer ??= []
    win.gtag = gtag
    // 동의 범주는 「분석」 하나 - 광고 저장소는 늘 거부, 분석 저장소는 지금 막 동의했으니 허용
    gtag('consent', 'default', {
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      analytics_storage: 'denied',
    })
    gtag('consent', 'update', { analytics_storage: 'granted' })
    gtag('js', new Date())
    // 첫 page_view 는 우리가 보낸다 - 주소에서 인증 값을 뗀 `page_location` 으로(gtag 가 스스로 읽으면 메일 링크의 `?token=` 이 실린다)
    gtag('config', gaId, { send_page_view: false })
    sendPageView()
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
    trackPageView() {
      if (gaLoaded && consent.has(category)) sendPageView()
    },
    start() {
      if (!doc || !win) return () => {}
      loadBeacon()
      apply()
      return consent.subscribe(apply)
    },
  }
}
