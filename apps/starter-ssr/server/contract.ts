/*
 * Node 서버(server/*.ts)와 서버 번들(src/entry-server.tsx)이 맞추는 계약 — 타입뿐이라 어느 쪽에서도 비용 없이 불러온다.
 */
export type RenderResult = {
  /** HTTP 상태 — 맞는 페이지 200, 없는 주소 404 */
  status: number
  /** `<div id="root">` 안 — 앱이 그린 HTML */
  html: string
  /** `<head>` 에 더할 조각 — `<title>` · 설명 · 상태 스크립트 */
  head: string
  /** 문서 제목(로그용) */
  title: string
}

/** 요청 주소(경로 + 쿼리)를 받아 그린다. 던지지 않는 것이 약속이다 — 데이터가 없으면 없는 채로 그린다 */
export type Render = (url: string) => Promise<RenderResult>
