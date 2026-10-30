import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { koReviewsLabels } from './labels'
import { ReportDialog } from './ReportDialog'
import { buildReportInput } from './reportInput'

describe('buildReportInput', () => {
  it('needs a reason; the detail is trimmed and left out when empty (the server gets nothing for it)', () => {
    expect(buildReportInput(null, '')).toBeNull()
    expect(buildReportInput('SPAM', '   ')).toEqual({ reason: 'SPAM' })
    expect(buildReportInput('OTHER', '  광고 링크  ')).toEqual({
      reason: 'OTHER',
      detail: '광고 링크',
    })
  })
})

describe('ReportDialog', () => {
  const render = (reasons = ['SPAM', 'ABUSE', 'OTHER'] as const) =>
    renderToStaticMarkup(
      <ReportDialog
        open
        reasons={[...reasons]}
        labels={koReviewsLabels}
        onClose={() => undefined}
        onSubmit={() => undefined}
      />,
    )

  it('has a title, one radio per reason the server allows (with the Korean words), a detail field and a send button', () => {
    const html = render()
    expect(html).toContain('리뷰 신고')
    expect(html.match(/type="radio"/g)).toHaveLength(3)
    expect(html).toContain('스팸 · 광고')
    expect(html).not.toContain('개인정보 노출')
    expect(html).toContain('<textarea')
    expect(html).toContain('신고하기')
  })

  it('groups the reasons under one name so a reader hears "신고 사유" before the choices', () => {
    const html = render()
    expect(html).toContain('<fieldset')
    expect(html).toContain('신고 사유')
  })
})
