/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/*
 * 눌리는 것은 한눈에 눌리는 것으로 보인다(원칙: docs/ui-catalog.md 맨 위; 같은 단정의 나머지는 tests/affordance.css.test.ts) —
 * 참조 앱의 링크 부품: 글자 링크는 밑줄, 링크 카드 · 링크 모양 버튼은 쉬는 상태에서 테두리나 채움이 있고 44px 이상, hover · focus 가 다르게 보인다.
 */
const css = (file: string) => readFileSync(new URL(file, import.meta.url), 'utf8')
function body(text: string, selector: string): string {
  const escaped = selector.replace(/[.[\]()':>*+~^$|\\]/g, '\\$&')
  return [...text.matchAll(new RegExp(`(?:^|\\n)\\s*${escaped}\\s*\\{([^}]*)\\}`, 'g'))]
    .map((m) => m[1])
    .join('\n')
}
const value = (text: string, property: string) =>
  text.match(new RegExp(`(?:^|[\\s;])${property}:\\s*([^;]+);`))?.[1].trim()
const px = (text: string | undefined) => Number(text?.replace('px', ''))
const visible = (v: string | undefined) => v !== undefined && v !== 'transparent'

describe('TextLink affordance', () => {
  const text = css('./TextLink.module.css')

  it('is underlined at rest, changes on hover and shows a focus ring', () => {
    expect(value(body(text, '.link'), 'text-decoration')).toMatch(/underline/)
    expect(body(text, '.link:hover')).not.toBe('')
    expect(body(text, '.link:focus-visible')).not.toBe('')
  })
})

describe('LinkCard affordance', () => {
  const text = css('./LinkCard.module.css')
  const base = body(text, '.card')

  it('is boxed at rest (a visible border, not transparent) and at least 44px tall', () => {
    expect(value(base, 'border')).toMatch(/^1px solid/)
    expect(value(base, 'border')).not.toMatch(/transparent/)
    expect(px(value(base, 'min-height'))).toBeGreaterThanOrEqual(44)
  })

  it('changes on hover and shows a focus ring', () => {
    expect(body(text, '.card:hover')).not.toBe('')
    expect(body(text, '.card:focus-visible')).not.toBe('')
  })
})

describe('LinkButton affordance', () => {
  const text = css('./LinkButton.module.css')

  it.each(['primary', 'secondary', 'ghost'])('%s is visibly boxed at rest', (variant) => {
    const rule = body(text, `.link[data-variant='${variant}']`)
    const border = value(rule, 'border-color')
    const background = value(rule, 'background')
    expect(visible(border) || visible(background), `${variant}: ${border} / ${background}`).toBe(
      true,
    )
  })

  it('is at least 44px tall', () => {
    expect(px(value(body(text, '.link'), 'min-height'))).toBeGreaterThanOrEqual(44)
  })
})
