/// <reference types="node" />
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

/** 링크 모양 버튼도 `Button` 과 같은 원칙 — 쉬는 상태에서 테두리나 채움이 있고 높이는 44px (packages/ui 의 Button/affordance.test.ts 와 짝) */
const css = readFileSync(new URL('./LinkButton.module.css', import.meta.url), 'utf8')
const rule = (variant: string) =>
  [...css.matchAll(new RegExp(`\\.link\\[data-variant='${variant}'\\]\\s*\\{([^}]*)\\}`, 'g'))]
    .map((m) => m[1])
    .join('\n')

describe('LinkButton affordance', () => {
  it.each(['primary', 'secondary', 'ghost'])('%s is visibly boxed at rest', (variant) => {
    const body = rule(variant)
    const border = body.match(/border-color:\s*([^;]+);/)?.[1]
    const background = body.match(/background:\s*([^;]+);/)?.[1]
    expect(
      (border !== undefined && border !== 'transparent') ||
        (background !== undefined && background !== 'transparent'),
      `${variant}: ${border} / ${background}`,
    ).toBe(true)
  })

  it('is at least 44px tall', () => {
    const base = css.match(/\.link\s*\{([^}]*)\}/)?.[1] ?? ''
    expect(Number(base.match(/min-height:\s*(\d+)px/)?.[1])).toBeGreaterThanOrEqual(44)
  })
})
