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
  it('PostEditor renders the picker with value, onChange, thread id, loading flag and no description when there is no error', () => {
    const html = renderToStaticMarkup(
      <PostEditor
        limits={limits}
        onSubmit={noop}
        authorRequired
        authorPicker={({ value, threadAuthorId, onChange, threadLoading, ...rest }) => (
          <i
            data-picker={`${value ?? 'none'}|${threadAuthorId ?? 'none'}|${typeof onChange}|${threadLoading}|${rest['aria-describedby'] ?? 'nodesc'}`}
          />
        )}
      />,
    )
    expect(html).toContain('data-picker="none|none|function|false|nodesc"')
    expect(html).toContain('data-author-slot')
  })

  it('CommentForm renders the picker too, handing over the thread id and the loading flag', () => {
    const html = renderToStaticMarkup(
      <CommentForm
        {...formProps}
        authorRequired
        authorPicker={({ threadAuthorId, threadLoading }) => (
          <i data-picker={`${threadAuthorId}|${threadLoading}`} />
        )}
        threadAuthorId="prf_a"
        threadLoading
      />,
    )
    expect(html).toContain('data-picker="prf_a|true"')
  })

  it('a picker is not drawn unless the server says authorRequired (the server would reject an authorId)', () => {
    const picker = () => <i data-picker="here" />
    expect(
      renderToStaticMarkup(<CommentForm {...formProps} authorPicker={picker} />),
    ).not.toContain('data-picker')
    expect(
      renderToStaticMarkup(
        <PostEditor limits={limits} onSubmit={noop} authorPicker={picker} authorRequired={false} />,
      ),
    ).not.toContain('data-picker')
  })

  it('without a picker the forms render exactly as before — no slot, nothing author-related', () => {
    for (const html of [
      renderToStaticMarkup(<CommentForm {...formProps} />),
      renderToStaticMarkup(<CommentForm {...formProps} authorRequired />),
      renderToStaticMarkup(<PostEditor limits={limits} onSubmit={noop} authorRequired={false} />),
    ]) {
      expect(html).not.toContain('data-author-slot')
      expect(html).not.toContain('data-picker')
    }
  })

  it('CommentThread keeps the reply picker out of the page until a reply form is opened', () => {
    const html = renderToStaticMarkup(
      <CommentThread
        {...threadProps}
        authorRequired
        thread={thread(1, [], { authorId: 'prf_a', mine: true })}
        authorPicker={() => <i data-picker="reply" />}
      />,
    )
    expect(html).not.toContain('data-picker')
  })
})
