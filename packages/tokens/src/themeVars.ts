/*
 * 생성 CSS(styles/tokens.css)를 테마별 `--이름 → 값` 표로 읽는다 — 테스트 전용.
 * 기본 테마 = `:root` 블록(원시 · 의미 기본), 다른 테마 = 기본 위에 `[data-theme='<이름>']` 블록(`<html>` 이든 컨테이너든)을 덮은 것(브라우저와 같은 순서),
 * 시스템 = 기본 위에 `@media (prefers-color-scheme: <scheme>)` 안 블록을 덮은 것.
 */
export interface CssBlock {
  /** 셀렉터(공백 · 줄바꿈을 한 칸으로) */
  selector: string
  /** 감싼 @media 조건 — 없으면 null */
  media: string | null
  /** 블록 안 선언 전부(custom property 와 color-scheme 같은 보통 속성) */
  declarations: Map<string, string>
}

const squash = (text: string) => text.replace(/\s+/g, ' ').trim()

/** 주석을 지운 CSS 의 규칙 블록 — @media 는 한 단계만 연다 */
export function cssBlocks(css: string): CssBlock[] {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '')
  const blocks: CssBlock[] = []
  const walk = (from: number, to: number, media: string | null) => {
    let start = from
    for (let i = from; i < to; i += 1) {
      if (text[i] !== '{') continue
      const head = squash(text.slice(start, i))
      let depth = 0
      let end = i
      for (; end < to; end += 1) {
        if (text[end] === '{') depth += 1
        if (text[end] === '}' && --depth === 0) break
      }
      if (head.startsWith('@media')) walk(i + 1, end, squash(head.slice('@media'.length)))
      else {
        const declarations = new Map<string, string>()
        for (const m of text.slice(i + 1, end).matchAll(/([\w-]+)\s*:\s*([^;]+);/g))
          declarations.set(m[1], squash(m[2]))
        blocks.push({ selector: head, media, declarations })
      }
      i = end
      start = end + 1
    }
  }
  walk(0, text.length, null)
  return blocks
}

export const themeSelector = (name: string) => `[data-theme='${name}']`

const overlay = (vars: Map<string, string>, block: CssBlock | undefined) => {
  if (block) for (const [k, v] of block.declarations) vars.set(k, v)
}

/** 테마 하나의 선언 전부(`--이름` 과 `color-scheme`; 값은 생성 CSS 글자 그대로, var() 포함) */
export function themeVars(
  css: string,
  theme: string,
  { system = false } = {},
): Map<string, string> {
  const vars = new Map<string, string>()
  const blocks = cssBlocks(css)
  // 기본 테마 블록 — `:root, [data-theme='light']`(컨테이너가 라이트를 고르는 경우도 같은 값)
  for (const b of blocks.filter(
    (b) => b.media === null && (b.selector === ':root' || b.selector.startsWith(':root, ')),
  ))
    overlay(vars, b)
  if (system)
    overlay(
      vars,
      blocks.find((b) => b.media !== null && b.selector.startsWith(':root')),
    )
  else if (theme !== 'light')
    overlay(
      vars,
      blocks.find((b) => b.selector === themeSelector(theme) && b.media === null),
    )
  return vars
}

/** `var(--x)` 를 값으로 끝까지 풀어 쓴다 — 이름이 없으면 던진다 */
export function expandVars(vars: Map<string, string>, value: string, depth = 0): string {
  if (depth > 10) throw new Error(`cycle: ${value}`)
  return value.replace(/var\((--[\w-]+)\)/g, (_, name: string) => {
    const next = vars.get(name)
    if (next === undefined) throw new Error(`${name} is not defined`)
    return expandVars(vars, next, depth + 1)
  })
}

export interface Rgba {
  r: number
  g: number
  b: number
  a: number
}

/** `#rgb` · `#rrggbb` · `rgb(…)` · `rgba(…)` (쉼표 꼴) */
export function parseColor(text: string): Rgba {
  const value = text.trim()
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value)
  if (hex) {
    const h = hex[1].length === 3 ? [...hex[1]].map((c) => c + c).join('') : hex[1]
    const n = parseInt(h, 16)
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 1 }
  }
  const fn = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i.exec(
    value,
  )
  if (fn) return { r: +fn[1], g: +fn[2], b: +fn[3], a: fn[4] === undefined ? 1 : +fn[4] }
  throw new Error(`not a colour: ${text}`)
}

/** 반투명 색을 바탕 위에 얹은 불투명 색 */
export function over(fg: Rgba, backdrop: Rgba): Rgba {
  const mix = (f: number, b: number) => f * fg.a + b * (1 - fg.a)
  return { r: mix(fg.r, backdrop.r), g: mix(fg.g, backdrop.g), b: mix(fg.b, backdrop.b), a: 1 }
}

function luminance({ r, g, b }: Rgba): number {
  const [lr, lg, lb] = [r, g, b].map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb
}

/** WCAG 2.x 대비 비율 — 둘 다 불투명이어야 한다 */
export function contrast(a: Rgba, b: Rgba): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}
