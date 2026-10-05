import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { CommentThread } from './CommentThread'
import { PostDetail } from './PostDetail'
import { PostList } from './PostList'
import { ReactionBar } from './ReactionBar'
import { comment, detail, summary, thread } from './test/fixtures'

describe('ReactionBar', () => {
  const noop = () => undefined

  it('renders exactly the types it is given, each as a toggle button inside a labelled group', () => {
    const html = renderToStaticMarkup(
      <ReactionBar
        types={['LIKE', 'EMPATHY']}
        counts={{ LIKE: 2, EMPATHY: 5, DISLIKE: 9 }}
        mine={['EMPATHY']}
        onToggle={noop}
      />,
    )
    expect(html).toContain('role="group"')
    expect(html).toContain('aria-label="Reactions"')
    expect(html.match(/<button/g)).toHaveLength(2)
    expect(html).not.toContain('DISLIKE') // 서버가 알리지 않은 종류는 그리지 않는다
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1)
    expect(html).toContain('>5<')
  })

  it('labels and icons come from the maps, with the code as the fallback', () => {
    const html = renderToStaticMarkup(
      <ReactionBar
        types={['EMPATHY', 'LAUGH']}
        counts={{}}
        mine={[]}
        onToggle={noop}
        labels={{ EMPATHY: '공감' }}
        icons={{ EMPATHY: '🤝' }}
      />,
    )
    expect(html).toContain('공감')
    expect(html).toContain('LAUGH')
    expect(html).toMatch(/aria-hidden="true"[^>]*>🤝/)
  })
})

describe('CommentThread', () => {
  const noop = () => undefined
  const props = { maxDepth: 2, commentMaxLength: 100 }

  it('nests the flat replies and folds the ones at collapseFromDepth behind a counted button', () => {
    const html = renderToStaticMarkup(
      <CommentThread
        {...props}
        thread={thread(1, [
          comment(2, 1, { body: 'depth one' }),
          comment(3, 2, { depth: 2, body: 'depth two' }),
        ])}
      />,
    )
    expect(html).toContain('depth one')
    expect(html).not.toContain('depth two')
    expect(html).toContain('Show 1 more reply')
    expect(html).toContain('aria-expanded="false"')
  })

  it('shows the placeholder text instead of a null body and gives it no actions', () => {
    const html = renderToStaticMarkup(
      <CommentThread
        {...props}
        onReply={noop}
        thread={thread(1, [], { body: null, status: 'DELETED' })}
        labels={{ deleted: '삭제된 댓글입니다.' }}
      />,
    )
    expect(html).toContain('삭제된 댓글입니다.')
    expect(html).not.toContain('<button')
  })

  it('offers reply only below the maximum depth, and edit/delete only on my own comments', () => {
    const html = renderToStaticMarkup(
      <CommentThread
        {...props}
        maxDepth={1}
        collapseFromDepth={99}
        currentUserId="me"
        onReply={noop}
        onEdit={noop}
        onDelete={noop}
        thread={thread(1, [comment(2, 1, { authorId: 'me' })], { authorId: 'other' })}
      />,
    )
    expect(html).toContain('aria-label="Reply: other"')
    expect(html).not.toContain('aria-label="Reply: me"') // 최대 깊이
    expect(html).toContain('aria-label="Edit: me"')
    expect(html).not.toContain('aria-label="Edit: other"')
  })

  it('moderator buttons appear only when canModerate', () => {
    const base = <CommentThread {...props} onModerate={noop} thread={thread(1)} />
    expect(renderToStaticMarkup(base)).not.toContain('Hide')
    expect(renderToStaticMarkup(<CommentThread {...base.props} canModerate />)).toContain('Hide')
  })
})

describe('PostList and PostDetail', () => {
  const noop = () => undefined

  it('PostList marks pinned and draft posts, sums the reactions and uses the title renderer', () => {
    const html = renderToStaticMarkup(
      <PostList
        posts={[
          summary(1, { pinned: true, reactionCounts: { LIKE: 2, EMPATHY: 3 } }),
          summary(2, { status: 'DRAFT' }),
        ]}
        page={0}
        totalPages={1}
        onPageChange={noop}
        sort="latest"
        onSortChange={noop}
        query=""
        onSearch={noop}
        renderTitle={(post) => <a href={`#${post.id}`}>{post.title}</a>}
        formatTime={() => 'then'}
      />,
    )
    expect(html).toContain('Pinned')
    expect(html).toContain('Draft')
    expect(html).toContain('>5<') // 반응 2 + 3
    expect(html).toContain('<a href="#1">Post 1</a>')
  })

  it('PostList tells an empty list from an empty search result', () => {
    const props = {
      posts: [],
      page: 0,
      totalPages: 0,
      onPageChange: noop,
      sort: 'latest' as const,
      onSortChange: noop,
      onSearch: noop,
    }
    expect(renderToStaticMarkup(<PostList {...props} query="" />)).toContain('No posts yet')
    expect(renderToStaticMarkup(<PostList {...props} query="zzz" />)).toContain('No posts match')
  })

  it('PostDetail renders the body, and only the actions that have a callback', () => {
    const none = renderToStaticMarkup(<PostDetail post={detail(1)} />)
    expect(none).toContain('Body of 1')
    expect(none).not.toContain('<button')
    const owner = renderToStaticMarkup(<PostDetail post={detail(1)} onEdit={noop} />)
    expect(owner).toContain('Edit')
    expect(owner).not.toContain('Delete')
  })
})
