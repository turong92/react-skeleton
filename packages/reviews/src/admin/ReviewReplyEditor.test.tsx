import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { koReviewsAdminLabels } from './labels'
import { ReviewReplyEditor } from './ReviewReplyEditor'

const reply = {
  body: '감사합니다',
  createdAt: '2026-10-29T01:00:00Z',
  updatedAt: '2026-10-29T01:00:00Z',
}
const render = (props: { reply: typeof reply | null; removable?: boolean }) =>
  renderToStaticMarkup(
    <ReviewReplyEditor
      reply={props.reply}
      labels={koReviewsAdminLabels}
      onSave={() => undefined}
      onRemove={props.removable === false ? undefined : () => undefined}
    />,
  )

describe('ReviewReplyEditor', () => {
  it('starts empty with a save button and no delete when there is no reply yet', () => {
    const html = render({ reply: null })
    expect(html).toContain('답글 저장')
    expect(html).not.toContain('답글 삭제')
  })

  it('edits the existing reply in place (one reply per review) and offers delete', () => {
    const html = render({ reply })
    expect(html).toContain('>감사합니다</textarea>')
    expect(html).toContain('답글 삭제')
  })

  it('no delete button when the app gives no onRemove (no permission)', () => {
    expect(render({ reply, removable: false })).not.toContain('답글 삭제')
  })
})
