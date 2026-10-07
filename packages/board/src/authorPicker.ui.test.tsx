import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { CommentForm } from './CommentForm'
import { CommentThread } from './CommentThread'
import { PostEditor } from './PostEditor'
import { comment, thread } from './test/fixtures'

const noop = () => undefined
const limits = { titleMaxLength: 20, bodyMaxLength: 100 }
const formProps = {
  label: 'Write',
  submitLabel: 'Send',
  maxLength: 100,
  requiredMessage: 'req',
  tooLongMessage: () => 'long',
  onSubmit: noop,
}
const threadProps = {
  maxDepth: 2,
  commentMaxLength: 100,
  collapseFromDepth: 99,
  onEdit: noop,
  onDelete: noop,
}

describe('mine-based ownership in CommentThread', () => {
  it('shows edit and delete for a comment the server marks mine even when authorId differs from currentUserId', () => {
    const html = renderToStaticMarkup(
      <CommentThread
        {...threadProps}
        currentUserId="acc_me"
        thread={thread(1, [], { authorId: 'prf_x', mine: true })}
      />,
    )
    expect(html).toContain('aria-label="Edit')
    expect(html).toContain('aria-label="Delete')
  })

  it('hides them when mine is false even if authorId equals currentUserId', () => {
    const html = renderToStaticMarkup(
      <CommentThread
        {...threadProps}
        currentUserId="acc_me"
        thread={thread(1, [], { authorId: 'acc_me', mine: false })}
      />,
    )
    expect(html).not.toContain('aria-label="Edit')
    expect(html).not.toContain('aria-label="Delete')
  })

  it('keeps the old id comparison when the server sends no mine', () => {
    const html = renderToStaticMarkup(
      <CommentThread {...threadProps} currentUserId="u1" thread={thread(1, [comment(2, 1)])} />,
    )
    expect(html).toContain('aria-label="Edit')
  })
})

describe('authorPicker slot', () => {
  it('PostEditor renders the picker with the current value, an onChange and the thread author id', () => {
    const html = renderToStaticMarkup(
      <PostEditor
        limits={limits}
        onSubmit={noop}
        authorPicker={({ value, threadAuthorId, onChange }) => (
          <i data-picker={`${value ?? 'none'}|${threadAuthorId ?? 'none'}|${typeof onChange}`} />
        )}
      />,
    )
    expect(html).toContain('data-picker="none|none|function"')
  })

  it('CommentForm renders the picker too', () => {
    const html = renderToStaticMarkup(
      <CommentForm
        {...formProps}
        authorPicker={() => <i data-picker="here" />}
        threadAuthorId="prf_a"
      />,
    )
    expect(html).toContain('data-picker="here"')
  })

  it('without a picker the forms render exactly as before', () => {
    expect(renderToStaticMarkup(<CommentForm {...formProps} />)).not.toContain('data-picker')
    expect(
      renderToStaticMarkup(<PostEditor limits={limits} onSubmit={noop} authorRequired={false} />),
    ).not.toContain('author')
  })
})
