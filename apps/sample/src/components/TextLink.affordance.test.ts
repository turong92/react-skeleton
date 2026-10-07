/// <reference types="node" />
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

/** 표 · 목록 안의 글자 링크 — 글자만 있으면 눌리는 줄로 안 보인다: 쉬는 상태에서 밑줄이 있고 hover · focus 가 다르게 보인다(원칙: docs/ui-catalog.md 맨 위) */
const css = readFileSync(new URL('./TextLink.module.css', import.meta.url), 'utf8')
const base = css.match(/\.link\s*\{([^}]*)\}/)?.[1] ?? ''

describe('TextLink affordance', () => {
  it('is underlined at rest', () => {
    expect(base).toMatch(/text-decoration:\s*underline/)
  })

  it('changes on hover and shows a focus ring', () => {
    expect(css).toMatch(/\.link:hover\s*\{/)
    expect(css).toMatch(/\.link:focus-visible\s*\{/)
  })
})
