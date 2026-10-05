import type { HeadSpec } from './headSpec'

type ElementLike = {
  setAttribute(name: string, value: string): void
  textContent: string | null
}

/** `document` 면 된다 — 테스트는 이 모양의 가짜를 준다 */
export type DocumentLike = {
  title: string
  head: {
    querySelectorAll(selector: string): Iterable<{ remove(): void }>
    appendChild(node: never): unknown
  }
  createElement(tag: string): ElementLike
}

/** 브라우저용 — 제목을 바꾸고 이전에 이 함수(또는 서버의 `renderHeadHtml`)가 만든 `data-seo` 태그만 갈아 끼운다. 다른 태그(charset · viewport · 테마 스크립트)는 건드리지 않는다 */
export function applyHead(spec: HeadSpec, doc: DocumentLike): void {
  doc.title = spec.title
  for (const old of Array.from(doc.head.querySelectorAll('[data-seo]'))) old.remove()
  for (const tag of spec.tags) {
    const element = doc.createElement(tag.tag)
    for (const [name, value] of Object.entries(tag.attrs)) element.setAttribute(name, value)
    element.setAttribute('data-seo', '')
    if (tag.text !== undefined) element.textContent = tag.text
    doc.head.appendChild(element as never)
  }
}
