/**
 * 스토리 · 테스트용 중립 문서(가게 소개). iframe 에 `srcdoc` 으로 싣는다.
 * `reportHeight` 면 문서 높이를 `{ type: 'sample-preview-height', height }` 로 부모에 알린다(`fakeFrameBridge`), `fixedBar` 면 바닥에 고정 막대
 */
export function sampleHtml(
  options: { sections?: number; reportHeight?: boolean; fixedBar?: boolean } = {},
): string {
  const { sections = 3, reportHeight = false, fixedBar = false } = options
  const body = Array.from(
    { length: sections },
    (_, i) =>
      `<section><h2>Section ${i + 1}</h2><p>Fresh coffee and baked goods, every day of the week.</p><p><a href="https://example.com/menu/${i + 1}">See the menu</a></p></section>`,
  ).join('')
  const report = reportHeight
    ? `<script>
        const send = () => parent.postMessage({ type: 'sample-preview-height', height: document.documentElement.scrollHeight }, '*')
        addEventListener('load', send)
        new ResizeObserver(send).observe(document.documentElement)
      </script>`
    : ''
  const bar = fixedBar
    ? '<div style="position:fixed;left:0;right:0;bottom:0;padding:12px;background:#222;color:#fff">Order now</div>'
    : ''
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Corner Cafe</title><style>body{margin:0;font-family:system-ui,sans-serif;color:#222;background:#fff}header{padding:32px 16px;background:#f0e6d8}section{padding:16px}a{color:#0b5cad}</style></head><body><header><h1>Corner Cafe</h1><p>A small neighbourhood cafe.</p></header>${body}${bar}${report}</body></html>`
}
