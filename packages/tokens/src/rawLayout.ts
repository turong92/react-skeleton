/* 간격 · 모서리 · 글자 크기 날값 탐지 — 테스트 전용. rawColors.ts 와 같은 방식(CSS 선언 + 인라인 style 객체) */
const SIDES = '(?:top|right|bottom|left|inline|block)(?:-(?:start|end))?'
const CAMEL_SIDES = '(?:Top|Right|Bottom|Left|Inline|Block)(?:Start|End)?'
const PROPERTY = [
  `padding(?:-${SIDES})?`,
  `margin(?:-${SIDES})?`,
  '(?:row-|column-)?gap',
  'border(?:-(?:top|bottom|start|end)-(?:left|right|start|end))?-radius',
  'font-size',
  `padding${CAMEL_SIDES}?`,
  `margin${CAMEL_SIDES}?`,
  '(?:row|column)?Gap',
  'border(?:(?:Top|Bottom|Start|End)(?:Left|Right|Start|End))?Radius',
  'fontSize',
].join('|')
const DECLARATION = new RegExp(
  `(?<![\\w-])(?:${PROPERTY})\\s*:\\s*(?:(['"\`])([^'"\`]*)\\1|([^;{}'"\`]*)(?=[;}]))`,
  'g',
)
const LITERAL = /(?<![\w.])-?\d*\.?\d+(?:rem|em|px)\b/g
const ZERO = /^-?(?:0+\.?0*|\.0+)(?:rem|em|px)$/

/** 변수 참조 var(…) 는 지우고 남은 값에서 0 이 아닌 px · rem · em 날값을 찾는다 (%, auto, 0, 키워드는 통과) */
export function findRawLayout(source: string): string[] {
  const found: string[] = []
  for (const m of source.matchAll(DECLARATION)) {
    const value = (m[2] ?? m[3]).replace(/var\((?:[^()]|\([^()]*\))*\)/g, '')
    found.push(...(value.match(LITERAL) ?? []).filter((literal) => !ZERO.test(literal)))
  }
  return found
}
