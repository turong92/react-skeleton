import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { CommentForm } from './CommentForm'
import { CommentThread } from './CommentThread'
import { PostDetail } from './PostDetail'
import { PostEditor } from './PostEditor'
import { detail, thread } from './test/fixtures'

const noop = () => undefined
const base = { maxDepth: 2, commentMaxLength: 100, collapseFromDepth: 99 }
const guestUi = { secretKind: 'PASSWORD', nameMaxLength: 20 } as const
const formProps = {
  label: 'Write',
  submitLabel: 'Send',
  maxLength: 100,
  requiredMessage: 'req',
  tooLongMessage: () => 'long',
  onSubmit: noop,
}

describe('guest fields', () => {
  it('a guest form asks for a name and a password; TOKEN mode asks for no password', () => {
    const html = renderToStaticMarkup(<CommentForm {...formProps} guest={guestUi} />)
    expect(html).toContain('name="guest-WriteName"')
    expect(html).toContain('type="password"')
    const token = renderToStaticMarkup(
      <CommentForm
        {...formProps}
        guest={{ ...guestUi, secretKind: 'TOKEN', token: 'a'.repeat(43) }}
      />,
    )
    expect(token).toContain('name="guest-WriteName"')
    expect(token).not.toContain('type="password"')
  })

  it('a signed-in form has no guest fields at all', () => {
    const html = renderToStaticMarkup(<CommentForm {...formProps} />)
    expect(html).not.toContain('guest-')
    expect(html).not.toContain('type="password"')
  })

  it('the post editor shows the guest fields only when given them', () => {
    const limits = { titleMaxLength: 20, bodyMaxLength: 100 }
    expect(
      renderToStaticMarkup(<PostEditor limits={limits} onSubmit={noop} guest={guestUi} />),
    ).toContain('type="password"')
    expect(renderToStaticMarkup(<PostEditor limits={limits} onSubmit={noop} />)).not.toContain(
      'type="password"',
    )
  })
})

describe('guest and waiting comments', () => {
  it('marks a guest author so a typed name cannot pass for a member nickname', () => {
    const html = renderToStaticMarkup(
      <CommentThread
        {...base}
        thread={thread(1, [], { authorGuest: true, authorName: 'Visitor' })}
      />,
    )
    expect(html).toContain('Visitor')
    expect(html).toContain('(guest)')
    expect(
      renderToStaticMarkup(
        <CommentThread {...base} thread={thread(1, [], { authorName: 'Member' })} />,
      ),
    ).not.toContain('(guest)')
  })

  it('a waiting comment shows its body with a badge, and only managers get Approve', () => {
    const waiting = thread(1, [], { status: 'PENDING', body: 'hello', mine: true })
    const plain = renderToStaticMarkup(
      <CommentThread {...base} thread={waiting} onModerate={noop} />,
    )
    expect(plain).toContain('hello')
    expect(plain).toContain('Waiting for approval')
    expect(plain).not.toContain('aria-label="Approve')
    const managed = renderToStaticMarkup(
      <CommentThread
        {...base}
        thread={thread(1, [], { status: 'PENDING', body: 'hello' })}
        canManageComments
        onModerate={noop}
      />,
    )
    expect(managed).toContain('aria-label="Approve')
    expect(managed).toContain('aria-label="Hide')
  })

  it('a managing owner cannot delete, a moderator can', () => {
    const t = thread(1, [], { body: 'x' })
    expect(
      renderToStaticMarkup(
        <CommentThread {...base} thread={t} canManageComments onDelete={noop} />,
      ),
    ).not.toContain('aria-label="Delete')
    expect(
      renderToStaticMarkup(<CommentThread {...base} thread={t} canModerate onDelete={noop} />),
    ).toContain('aria-label="Delete')
  })

  it("this browser's own guest comment can be edited and deleted even though the server says mine=false", () => {
    const t = thread(7, [], { authorGuest: true, mine: false })
    const own = renderToStaticMarkup(
      <CommentThread
        {...base}
        thread={t}
        ownGuestIds={new Set([7])}
        onEdit={noop}
        onDelete={noop}
      />,
    )
    expect(own).toContain('aria-label="Edit')
    expect(own).toContain('aria-label="Delete')
    const other = renderToStaticMarkup(
      <CommentThread
        {...base}
        thread={t}
        ownGuestIds={new Set([8])}
        onEdit={noop}
        onDelete={noop}
      />,
    )
    expect(other).not.toContain('aria-label="Edit')
  })

  it('a hidden comment the server says the manager cannot change gets no restore button', () => {
    const hidden = (canManage?: boolean) =>
      renderToStaticMarkup(
        <CommentThread
          {...base}
          thread={thread(3, [], { status: 'HIDDEN', body: null, canManage })}
          canManageComments
          onModerate={noop}
        />,
      )
    expect(hidden(false)).not.toContain('aria-label="Restore')
    expect(hidden(true)).toContain('aria-label="Restore')
    expect(hidden(undefined)).toContain('aria-label="Restore')
  })

  it('a waiting edit: the writer sees a note, a manager sees both texts side by side with decide buttons, everyone else sees nothing', () => {
    const revision = { body: 'new text', attachments: [], submittedAt: '2026-01-01T00:00:00Z' }
    const t = thread(1, [], { body: 'old text', mine: true, pendingRevision: revision })
    const writer = renderToStaticMarkup(<CommentThread {...base} thread={t} />)
    expect(writer).toContain('waiting for approval')
    expect(writer).toContain('new text')
    const manager = renderToStaticMarkup(
      <CommentThread
        {...base}
        thread={thread(1, [], { body: 'old text', pendingRevision: revision })}
        canManageComments
        onDecideRevision={noop}
      />,
    )
    expect(manager).toContain('old text')
    expect(manager).toContain('new text')
    expect(manager).toContain('aria-label="Approve edit')
    const stranger = renderToStaticMarkup(
      <CommentThread
        {...base}
        thread={thread(1, [], { body: 'old text', pendingRevision: null })}
      />,
    )
    expect(stranger).not.toContain('Edited')
  })

  it("pictures are drawn by the app's renderAttachment and only for visible comments", () => {
    const shown = renderToStaticMarkup(
      <CommentThread
        {...base}
        thread={thread(1, [], { body: 'x', attachments: ['k/1.png'] })}
        renderAttachment={(key) => <img alt="" src={`/files/${key}`} />}
      />,
    )
    expect(shown).toContain('src="/files/k/1.png"')
    const hidden = renderToStaticMarkup(
      <CommentThread
        {...base}
        thread={thread(1, [], { status: 'HIDDEN', body: null, attachments: ['k/1.png'] })}
        renderAttachment={(key) => <img alt="" src={key} />}
      />,
    )
    expect(hidden).not.toContain('k/1.png')
  })
})

describe('edited pictures in the revision compare', () => {
  const revision = {
    body: 'new',
    attachments: ['k/keep', 'k/new'],
    submittedAt: '2026-01-01T00:00:00Z',
  }

  it('a comment manager sees added and removed pictures marked next to the published ones, the writer does not', () => {
    const t = thread(1, [], {
      body: 'old',
      attachments: ['k/keep', 'k/gone'],
      pendingRevision: revision,
    })
    const manager = renderToStaticMarkup(
      <CommentThread
        {...base}
        thread={t}
        canManageComments
        onDecideRevision={noop}
        renderAttachment={(key) => <b>{key}</b>}
      />,
    )
    expect(manager).toMatch(/data-change="added"[^>]*>(<b>k\/new<\/b>)/)
    expect(manager).toMatch(/data-change="removed"[^>]*>(<b>k\/gone<\/b>)/)
    expect(manager).toMatch(/data-change="kept"[^>]*>(<b>k\/keep<\/b>)/)
    const writer = renderToStaticMarkup(
      <CommentThread
        {...base}
        thread={thread(1, [], { body: 'old', mine: true, pendingRevision: revision })}
      />,
    )
    expect(writer).not.toContain('revision-pictures')
  })

  it('a post moderator sees the same comparison', () => {
    const post = detail(1, {
      attachments: ['k/gone'],
      pendingRevision: { ...revision, title: 'T2' },
    })
    const html = renderToStaticMarkup(
      <PostDetail post={post} onDecideRevision={noop} renderAttachment={(key) => <b>{key}</b>} />,
    )
    expect(html).toMatch(/data-change="added"[^>]*>(<b>k\/new<\/b>)/)
    expect(html).toMatch(/data-change="removed"[^>]*>(<b>k\/gone<\/b>)/)
  })
})

describe('post detail with approval', () => {
  it('shows the waiting note, and the revision compare with decide buttons only to a moderator callback', () => {
    const pendingRevision = {
      title: 'T2',
      body: 'B2',
      attachments: [],
      submittedAt: '2026-01-01T00:00:00Z',
    }
    const post = detail(1, { status: 'PENDING', pendingRevision })
    const html = renderToStaticMarkup(<PostDetail post={post} />)
    expect(html).toContain('Waiting for approval')
    expect(html).toContain('waiting for approval')
    const mod = renderToStaticMarkup(<PostDetail post={post} onDecideRevision={noop} />)
    expect(mod).toContain('Approve edit')
    expect(mod).toContain('Published now')
    expect(html).not.toContain('Approve edit')
  })
})
