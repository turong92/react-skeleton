import { PRE_PAINT_SCRIPT } from './prePaint.ts'

// 확장자(.ts)를 적는다: vite.config.ts 는 Node 가 직접 읽어 이 파일까지 따라오는데, Node 는 확장자 없는 import 를 풀지 않는다
// (Node 22.18+/24 의 타입 제거로 읽는다 — `erasableSyntaxOnly` 가 그래서 켜져 있다). DOM 을 쓰는 theme.ts 는 끌어오지 않는다.
/** Vite 플러그인 꼴(vite 를 import 하지 않는다) — vite.config.ts 의 `plugins` 에 `themePrePaint()` */
export function themePrePaint() {
  return {
    name: 'skeleton-theme-pre-paint',
    transformIndexHtml() {
      return [{ tag: 'script', children: PRE_PAINT_SCRIPT, injectTo: 'head-prepend' as const }]
    },
  }
}
