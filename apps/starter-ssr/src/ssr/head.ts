/*
 * 서버가 HTML 에 넣고 클라이언트가 읽는 것들 — 제목 · 설명 · 쿼리 캐시(dehydrate 결과).
 * 서버 번들(entry-server)과 브라우저(entry-client)가 같은 파일을 쓴다. DOM 을 직접 부르지 않는다(`readSsrState` 는 문서를 인자로 받는다).
 */
const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

export const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (char) => ESCAPES[char])

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
  title: string
  description: string
  /** 검색에 안 뜨게 할 페이지(`noindex`) — 계정 · 404 */
  robots?: string
  /** 클라이언트가 이어받을 상태(보통 `dehydrate(queryClient)`) */
  state: unknown
}

/** `<head>` 에 들어갈 조각 — 문서 틀(템플릿)의 `<!--app-head-->` 자리에 들어간다 */
export function buildHead({ title, description, robots, state }: HeadInput): string {
  return [
    `<title>${escapeHtml(title)}</title>`,
    `<meta name="description" content="${escapeHtml(description)}" />`,
    robots ? `<meta name="robots" content="${escapeHtml(robots)}" />` : '',
    `<script type="application/json" id="${SSR_STATE_ID}">${serializeState(state)}</script>`,
  ]
    .filter(Boolean)
    .join('\n    ')
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
