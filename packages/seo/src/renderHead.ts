import type { HeadSpec } from './headSpec'

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}
export const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (char) => ESCAPES[char])

/**
 * 서버 렌더용 — 머리 조각 글자(`<title>` + 태그들). 태그마다 `data-seo` 를 달아 브라우저의 `applyHead` 가 같은 것을 알아보고 갈아 끼운다.
 * JSON-LD 의 글자는 이미 `serializeJsonLd` 로 이스케이프되어 있어 그대로 넣는다.
 */
export function renderHeadHtml(spec: HeadSpec): string {
  const lines = [`<title>${escapeHtml(spec.title)}</title>`]
  for (const tag of spec.tags) {
    const attrs = Object.entries(tag.attrs)
      .map(([name, value]) => `${name}="${escapeHtml(value)}"`)
      .join(' ')
    lines.push(
      tag.tag === 'script'
        ? `<script ${attrs} data-seo>${tag.text ?? ''}</script>`
        : `<${tag.tag} ${attrs} data-seo />`,
    )
  }
  return lines.join('\n    ')
}
