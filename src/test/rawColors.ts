/* 날 색 탐지 — 테스트 전용. CSS 선언과 인라인 style 객체 모두에서 색이 올 수 있는 속성의 값만 본다 */
const PROPERTY =
  '(?:color|background(?:-color|-image)?|border(?:-(?:top|right|bottom|left))?(?:-color)?|outline(?:-color)?|fill|stroke|box-shadow|text-shadow|caret-color|accent-color|column-rule(?:-color)?|text-decoration(?:-color)?)'
// camelCase(인라인 style)도 같은 속성으로 본다
const DECLARATION = new RegExp(
  `(?<![\\w-])(?:${PROPERTY}|backgroundColor|backgroundImage|borderColor|borderTop|borderRight|borderBottom|borderLeft|outlineColor|boxShadow|textShadow)\\s*:\\s*(?:(['"\`])([^'"\`]*)\\1|([^;{}'"\`]*)(?=[;}]))`,
  'g',
)
const COLOR_VALUE =
  /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\([^)]*\)|\b(?:white|black|red|green|blue|gray|grey|silver|maroon|purple|fuchsia|lime|olive|yellow|navy|teal|aqua|orange|pink|brown|gold|ivory|beige|crimson|tomato|coral|salmon|violet|indigo|cyan|magenta)\b/g

/** 변수 참조 var(…) 는 지우고 남은 값에서 날 색을 찾는다 */
export function findRawColors(source: string): string[] {
  const found: string[] = []
  for (const m of source.matchAll(DECLARATION)) {
    const value = (m[2] ?? m[3]).replace(/var\((?:[^()]|\([^()]*\))*\)/g, '')
    found.push(...(value.match(COLOR_VALUE) ?? []))
  }
  return found
}
