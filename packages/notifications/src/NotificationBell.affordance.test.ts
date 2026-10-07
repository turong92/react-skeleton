/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/** 눌리는 것은 쉬는 상태에서도 눌리는 것으로 보인다 — 테두리 + 44px 목표(원칙은 docs/ui-catalog.md, @skeleton/ui 의 Button/affordance.test.ts 와 같은 단정). 자기 패키지의 파일만 읽는다 */
const css = readFileSync(new URL('./NotificationBell.module.css', import.meta.url), 'utf8')
const rule = (selector: string) => {
  const escaped = selector.replace(/[.[\]()':>*+~^$|\\]/g, '\\$&')
  return [...css.matchAll(new RegExp(`(?:^|\\n)\\s*${escaped}\\s*\\{([^}]*)\\}`, 'g'))]
    .map((m) => m[1])
    .join('\n')
}
const value = (text: string, property: string) =>
  text.match(new RegExp(`(?:^|[\\s;])${property}:\\s*([^;]+);`))?.[1].trim()

describe('NotificationBell affordance', () => {
  it('is a bordered box that is at least 44px tall', () => {
    const body = rule('.bell')
    expect(value(body, 'border')).toMatch(/solid/)
    expect(value(body, 'border')).not.toMatch(/transparent/)
    expect(Number(value(body, 'height')?.replace('px', ''))).toBeGreaterThanOrEqual(44)
    expect(value(body, 'cursor')).toBe('pointer')
  })
})
