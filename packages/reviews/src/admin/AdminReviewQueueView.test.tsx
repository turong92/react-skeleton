import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { AdminReviewQueueView } from './AdminReviewQueueView'
import { koReviewsAdminLabels } from './labels'
import type { AdminReview } from './types'

const row = (over: Partial<AdminReview> = {}): AdminReview => ({
  id: 'r1',
  targetType: 'product',
  targetId: 'basic',
  rating: 4,
  body: '배송이 빠르고 좋아요 정말로',
  status: 'PUBLISHED',
  moderationReason: null,
  reportCount: 3,
  reportReasons: { SPAM: 2, ABUSE: 1 },
  lastReportedAt: '2026-10-29T01:00:00Z',
  accountLabel: null,
  reply: null,
  createdAt: '2026-10-28T01:00:00Z',
  ...over,
})

const render = (rows: AdminReview[], can: (key: string) => boolean = () => true) =>
  renderToStaticMarkup(
    <AdminReviewQueueView
      rows={rows}
      labels={koReviewsAdminLabels}
      can={can}
      queue="reported"
      onQueueChange={() => undefined}
      onHide={() => undefined}
      onDismiss={() => undefined}
      onRestore={() => undefined}
      onReply={() => undefined}
    />,
  )

describe('AdminReviewQueueView', () => {
  it('shows the reasons as chips with their counts, so the operator sees why it was reported', () => {
    const html = render([row()])
    expect(html).toContain('스팸 · 광고 2')
    expect(html).toContain('욕설 · 비하 1')
    expect(html).toContain('3건')
  })

  it('a public reported review offers hide / no-problem / reply — and no restore', () => {
    const html = render([row()])
    expect(html).toContain('숨기기: ')
    expect(html).toContain('문제없음: ')
    expect(html).toContain('답글: ')
    expect(html).not.toContain('되살리기: ')
  })

  it('a hidden review offers restore (with the reason shown) — and no hide / no-problem', () => {
    const html = render([
      row({ status: 'HIDDEN', moderationReason: '광고', reportCount: 0, reportReasons: {} }),
    ])
    expect(html).toContain('되살리기: ')
    expect(html).toContain('사유: 광고')
    expect(html).not.toContain('숨기기: ')
    expect(html).not.toContain('문제없음: ')
  })

  it('buttons follow can(key): without review.moderate there is no hide / dismiss / restore; without review.reply no reply', () => {
    const onlyReply = render(
      [row(), row({ id: 'r2', status: 'HIDDEN' })],
      (k) => k === 'review.reply',
    )
    expect(onlyReply).toContain('답글: ')
    expect(onlyReply).not.toMatch(/숨기기: |문제없음: |되살리기: /)
    const onlyModerate = render([row()], (k) => k === 'review.moderate')
    expect(onlyModerate).toContain('숨기기: ')
    expect(onlyModerate).not.toContain('답글: ')
  })

  it('names the empty state after the queue', () => {
    expect(render([])).toContain('기다리는 신고가 없어요.')
  })
})
