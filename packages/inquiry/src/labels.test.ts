import { describe, expect, it } from 'vitest'
import { defaultInquiryLabels, koInquiryLabels, resolveInquiryLabels } from './labels'

/** 모든 문구 자리의 경로와 종류(문자열 · 함수의 결과) — 두 언어가 같은 자리를 채웠는지 본다 */
function shape(value: unknown, path = ''): string[] {
  if (typeof value === 'string') return [`${path}:string`]
  if (typeof value === 'function') {
    const out = (value as (...a: unknown[]) => unknown)(1, 2)
    return [`${path}:fn->${typeof out}`]
  }
  return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) =>
    shape(v, path ? `${path}.${k}` : k),
  )
}

describe('inquiry labels', () => {
  it('Korean fills exactly the places English does', () => {
    expect(shape(koInquiryLabels)).toEqual(shape(defaultInquiryLabels))
  })

  it('an app may change a few sentences inside a group and keep the rest', () => {
    const merged = resolveInquiryLabels({ form: { submit: 'Send it' } })
    expect(merged.form.submit).toBe('Send it')
    expect(merged.form.sending).toBe(defaultInquiryLabels.form.sending)
    expect(merged.errors).toEqual(defaultInquiryLabels.errors)
  })
})
