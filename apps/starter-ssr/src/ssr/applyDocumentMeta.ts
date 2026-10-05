/** `document` 에서 쓰는 만큼 — 테스트는 작은 가짜를 넘긴다 */
export type MetaDocument = Pick<Document, 'title' | 'createElement'> & {
  querySelector(selector: string): Element | null
  head: Pick<HTMLHeadElement, 'appendChild'>
}

function upsertMeta(doc: MetaDocument, name: string, content: string | undefined) {
  const found = doc.querySelector(`meta[name="${name}"]`)
  if (content === undefined) return found?.remove()
  if (found) return found.setAttribute('content', content)
  const created = doc.createElement('meta')
  created.setAttribute('name', name)
  created.setAttribute('content', content)
  doc.head.appendChild(created)
}

/**
 * 브라우저 안에서 라우트를 옮길 때(서버를 다시 거치지 않는다) 제목 · 설명 · robots 를 그 페이지의 것으로 맞춘다.
 * 서버가 처음 응답에 넣은 값과 같은 출처(`documentMeta`)라 처음 로드에서는 아무것도 바꾸지 않는다.
 */
export function applyDocumentMeta(
  doc: MetaDocument,
  meta: { title: string; description: string; robots?: string },
) {
  doc.title = meta.title
  upsertMeta(doc, 'description', meta.description)
  upsertMeta(doc, 'robots', meta.robots)
}
