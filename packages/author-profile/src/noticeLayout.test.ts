/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/*
 * 닉네임을 바꿀 때의 확인 문장은 좁은 화면에서 줄이 바뀐다 — 한국어가 `이름 / #꼬리표` 처럼 이름 한가운데서 끊기지 않게(`keep-all`),
 * 정말 한 낱말이 칸보다 길 때만 낱말 안에서 끊는다(`overflow-wrap`). 눈으로 보는 것은 sample 의 e2e 캡처.
 */
const css = readFileSync(new URL('./AuthorPicker.module.css', import.meta.url), 'utf8')
const text = css.match(/\.noticeText\s*\{([^}]*)\}/)?.[1] ?? ''

describe('the confirmation sentence wraps naturally', () => {
  it('does not break inside a Korean word, but never overflows', () => {
    expect(text).toMatch(/word-break:\s*keep-all/)
    expect(text).toMatch(/overflow-wrap:\s*anywhere/)
  })

  it('is readable text (small, not the tiny caption)', () => {
    expect(css.match(/\.notice\s*\{([^}]*)\}/)?.[1]).toMatch(
      /font-size:\s*var\(--font-size-small\)/,
    )
  })

  it('is one warning-toned block (a request to confirm, not an error): amber border + soft amber background', () => {
    const notice = css.match(/\.notice\s*\{([^}]*)\}/)?.[1] ?? ''
    expect(notice).toMatch(/border:\s*1px solid var\(--amber\)/)
    expect(notice).toMatch(/background:\s*var\(--amber-soft\)/)
  })
})
