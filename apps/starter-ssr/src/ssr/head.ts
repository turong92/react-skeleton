import { escapeHtml, renderHeadHtml, type HeadSpec } from '@skeleton/seo'

/*
 * 서버가 HTML 에 넣고 클라이언트가 읽는 것들 — 머리(`@skeleton/seo`) · 쿼리 캐시(dehydrate 결과) · 공개 주소.
 * 서버 번들(entry-server)과 브라우저(entry-client)가 같은 파일을 쓴다. DOM 을 직접 부르지 않는다(`readSsrState` 는 문서를 인자로 받는다).
 */
export { escapeHtml }

/** `<script type="application/json" id>` 의 id — 클라이언트가 같은 값으로 읽는다 */
export const SSR_STATE_ID = '__SSR_STATE__'

/**
 * 상태를 `<script type="application/json">` 안에 넣을 JSON 으로. `<` 를 `<` 로 바꿔 `</script>` · `<!--` 로 빠져나올 수 없고,
 * 줄 구분 문자(U+2028/2029)도 바꾼다. 값은 JSON 으로 되돌렸을 때 그대로다.
 */
export function serializeState(state: unknown): string {
  return JSON.stringify(state)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
}

export type HeadInput = {
  /** `@skeleton/seo` 의 `buildHeadSpec` 결과 — 제목 · 설명 · canonical · OG · robots · JSON-LD */
  spec: HeadSpec
  /** 클라이언트가 이어받을 상태(보통 `dehydrate(queryClient)`) */
  state: unknown
  /** 사이트의 공개 주소 — 브라우저가 라우트를 옮길 때 서버와 같은 canonical 을 쓰도록 알려 준다 */
  siteUrl?: string
}

/** 브라우저가 공개 주소를 읽는 `<meta>` 의 이름 */
export const SITE_URL_META = 'app:site-url'

/** `<head>` 에 들어갈 조각 — 문서 틀(템플릿)의 `<!--app-head-->` 자리에 들어간다 */
export function buildHead({ spec, state, siteUrl }: HeadInput): string {
  return [
    renderHeadHtml(spec),
    siteUrl ? `<meta name="${SITE_URL_META}" content="${escapeHtml(siteUrl)}" />` : '',
    `<script type="application/json" id="${SSR_STATE_ID}">${serializeState(state)}</script>`,
  ]
    .filter(Boolean)
    .join('\n    ')
}

/** `document` 면 된다 — 테스트는 `querySelector` 만 가진 객체를 준다 */
export type SiteUrlHost = {
  querySelector(selector: string): { getAttribute(name: string): string | null } | null
}

/** 브라우저에서 서버가 알려 준 공개 주소를 읽는다(없으면 `undefined`) */
export function readSiteUrl(doc: SiteUrlHost): string | undefined {
  return doc.querySelector(`meta[name="${SITE_URL_META}"]`)?.getAttribute('content') ?? undefined
}

/** `document` 면 된다 — 테스트는 `getElementById` 만 가진 객체를 준다 */
export type StateHost = { getElementById(id: string): { textContent: string | null } | null }

/** 브라우저에서 서버가 넣은 상태를 읽는다. 없거나 깨졌으면 `undefined` — 클라이언트가 처음부터 가져온다 */
export function readSsrState(doc: StateHost): unknown {
  const text = doc.getElementById(SSR_STATE_ID)?.textContent
  if (!text) return undefined
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}
