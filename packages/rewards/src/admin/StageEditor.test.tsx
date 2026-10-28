import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { CouponStage } from '../types'
import { koRewardsAdminLabels } from './labels'
import { StageEditor } from './StageEditor'

const stage = (periods: number | null): CouponStage => ({
  type: 'PERCENT',
  value: 10,
  maxDiscount: null,
  periods,
})
const html = (stages: CouponStage[]) =>
  renderToStaticMarkup(
    <StageEditor stages={stages} onChange={() => {}} labels={koRewardsAdminLabels} />,
  )
const buttonOf = (out: string, label: string) =>
  out.match(new RegExp(`<button[^>]*>[^<]*${label}`))?.[0] ?? ''

describe('StageEditor', () => {
  it('offers the two templates and an add button', () => {
    const out = html([])
    for (const text of ['무료 이용권', '3달 무료', '단계 더하기', '단계를 하나 이상'])
      expect(out, text).toContain(text)
  })

  it('the add button is disabled from the sixth step on, with the reason beside it', () => {
    const five = html(Array.from({ length: 5 }, () => stage(1)))
    expect(buttonOf(five, '단계 더하기')).toMatch(/\sdisabled/)
    expect(five).toContain('단계는 5개까지예요.')
    expect(buttonOf(html([stage(1)]), '단계 더하기')).not.toMatch(/\sdisabled/)
  })

  it('「영원히」 is a checkbox only the last step can tick', () => {
    const out = html([stage(1), stage(null)])
    const boxes = [...out.matchAll(/<input[^>]*type="checkbox"[^>]*>/g)].map((m) => m[0])
    expect(boxes).toHaveLength(2)
    expect(boxes[0]).toMatch(/\sdisabled/)
    expect(boxes[1]).not.toMatch(/\sdisabled/)
    expect(boxes[1]).toContain('checked')
    expect(out).toContain('마지막 단계만 영원히 할 수 있어요.')
  })

  it('a free step has no value box; a percent step has value and cap', () => {
    const free = html([{ type: 'FREE', value: 0, maxDiscount: null, periods: 1 }])
    expect(free).not.toContain('1단계 값')
    const percent = html([stage(1)])
    expect(percent).toContain('1단계 값')
    expect(percent).toContain('1단계 최대 할인 금액')
  })
})
