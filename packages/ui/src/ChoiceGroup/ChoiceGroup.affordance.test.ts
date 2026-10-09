/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * 선택 묶음도 눌리는 것이다 — 쉬는 상태에서 테두리가 있고(`Button` 의 보조 모양) 44px 이상이며,
 * 고른 것은 색만이 아니라 테두리 · 바탕 · 안쪽 선 · 체크 표시로 분명하다. 안 고른 칸의 hover 는 고른 칸과 다른 모양이다. 못 누르는(잠긴) 것은 흐려진다.
 */
const css = readFileSync(new URL('./ChoiceGroup.module.css', import.meta.url), 'utf8')
const rule = (selector: RegExp) => css.match(selector)?.[1] ?? ''

describe('ChoiceGroup affordance', () => {
  it('is at least 44px tall at rest', () => {
    const base = rule(/\.choice\s*\{([^}]*)\}/)
    expect(Number(base.match(/min-height:\s*(\d+)px/)?.[1])).toBeGreaterThanOrEqual(44)
  })

  it('the chosen one changes border, fill and weight — beyond colour alone', () => {
    const chosen = rule(/\.choice\[aria-checked='true'\]\s*\{([^}]*)\}/)
    expect(chosen).toMatch(/border-color:\s*var\(--teal\)/)
    expect(chosen).toMatch(/background:\s*var\(--teal-wash\)/)
    expect(chosen).toMatch(/box-shadow:\s*inset/)
  })

  it('hovering one that is not chosen never makes it look chosen (no teal border, no teal fill, no inner line)', () => {
    const hover = rule(
      /\.choice[^{]*:hover[^{]*:not\(\[aria-checked='true'\]\)[^{]*\{([^}]*)\}|\.choice[^{]*:not\(\[aria-checked='true'\]\)[^{]*:hover[^{]*\{([^}]*)\}/,
    )
    expect(hover, 'a hover rule for the choices that are not chosen').not.toBe('')
    expect(hover).not.toMatch(/--teal/)
    expect(hover).not.toMatch(/box-shadow/)
    expect(hover).toMatch(/border-color:/)
  })

  it('a locked group looks locked', () => {
    expect(css).toMatch(/\[aria-disabled='true'\]/)
  })
})
