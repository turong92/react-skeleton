/// <reference types="node" />
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

/** 줄 전체가 눌리는 링크 카드 — 쉬는 상태에서 테두리가 있고(글자만 있으면 안 눌리는 줄로 보인다) 44px 이상, 화살표가 붙고, hover · focus 가 다르게 보인다 */
const css = readFileSync(new URL('./LinkCard.module.css', import.meta.url), 'utf8')
const base = css.match(/\.card\s*\{([^}]*)\}/)?.[1] ?? ''

describe('LinkCard affordance', () => {
  it('is boxed at rest (a visible border, not transparent)', () => {
    const border = base.match(/border:\s*1px solid\s*([^;]+);/)?.[1]
    expect(border).toBeDefined()
    expect(border).not.toBe('transparent')
  })

  it('is at least 44px tall', () => {
    expect(Number(base.match(/min-height:\s*(\d+)px/)?.[1])).toBeGreaterThanOrEqual(44)
  })

  it('changes on hover and shows a focus ring', () => {
    expect(css).toMatch(/\.card:hover\s*\{/)
    expect(css).toMatch(/\.card:focus-visible\s*\{/)
  })
})
