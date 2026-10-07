import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { AuthorName } from './AuthorName'
import { nameKey } from './authorDisplay'
import { CommentThread } from './CommentThread'
import { PostDetail } from './PostDetail'
import { PostList } from './PostList'
import { comment, detail, summary, thread } from './test/fixtures'

const noop = () => undefined
const listProps = {
  page: 0,
  totalPages: 1,
  onPageChange: noop,
  sort: 'latest' as const,
  onSortChange: noop,
  query: '',
  onSearch: noop,
}
const threadProps = { maxDepth: 2, commentMaxLength: 100, collapseFromDepth: 99 }

describe('author display — PostList', () => {
  const html = renderToStaticMarkup(
    <PostList
      {...listProps}
      posts={[
        summary(1, { authorId: 'acc_named', authorName: '수민' }),
        summary(2, { authorId: 'acc_noname', authorName: null }),
        summary(3, { authorId: 'deleted:abc123', authorDeleted: true }),
      ]}
    />,
  )

  it('has an author column and names the three kinds of author', () => {
    expect(html).toContain('>Author<')
    expect(html).toContain('수민')
    expect(html).toContain('Unnamed user')
    expect(html).toContain('Deleted user')
  })

  it('never prints an account id', () => {
    expect(html).not.toContain('acc_')
    expect(html).not.toContain('deleted:')
  })

  it('translates through labels', () => {
    const ko = renderToStaticMarkup(
      <PostList
        {...listProps}
        posts={[summary(1, { authorId: 'deleted:x' })]}
        labels={{ author: '작성자', authorDeleted: '탈퇴한 사용자' }}
      />,
    )
    expect(ko).toContain('>작성자<')
    expect(ko).toContain('탈퇴한 사용자')
  })
})

describe('author display — PostDetail', () => {
  it('shows the author with the date under the title, without the account id', () => {
    const html = renderToStaticMarkup(
      <PostDetail post={detail(1, { authorId: 'acc_x', authorName: '수민' })} />,
    )
    expect(html).toContain('수민')
    expect(html).not.toContain('acc_x')
  })

  it('reads a withdrawn author as Deleted user', () => {
    const html = renderToStaticMarkup(
      <PostDetail post={detail(1, { authorId: 'deleted:zz', authorDeleted: true })} />,
    )
    expect(html).toContain('Deleted user')
    expect(html).not.toContain('deleted:')
  })
})

describe('author display — comments', () => {
  it('shows names for comments and replies, and names the action buttons after the name', () => {
    const html = renderToStaticMarkup(
      <CommentThread
        {...threadProps}
        currentUserId="acc_me"
        onReply={noop}
        onEdit={noop}
        thread={thread(
          1,
          [comment(2, 1, { authorId: 'deleted:q', authorDeleted: true }), comment(3, 1)],
          { authorId: 'acc_me', authorName: '수민' },
        )}
      />,
    )
    expect(html).toContain('수민')
    expect(html).toContain('Deleted user')
    expect(html).toContain('Unnamed user')
    expect(html).toContain('aria-label="Reply: 수민"')
    expect(html).toContain('aria-label="Edit: 수민"')
    expect(html).not.toContain('acc_me')
    expect(html).not.toContain('deleted:q')
  })

  it('reads the name once: the avatar is hidden from screen readers', () => {
    const html = renderToStaticMarkup(
      <CommentThread {...threadProps} thread={thread(1, [], { authorName: '수민' })} />,
    )
    expect(html).toMatch(/aria-hidden="true"[^>]*><span[^>]*role="img"[^>]*aria-label="수민"/)
    expect(html.match(/수민/g)?.length).toBeLessThanOrEqual(2) // 아바타 라벨 + 보이는 이름. 접근성 트리에는 이름만
  })

  it('keeps renderAuthor working with the old (authorId) signature and also hands over the resolved author', () => {
    const seen: unknown[] = []
    const html = renderToStaticMarkup(
      <CommentThread
        {...threadProps}
        thread={thread(1, [], { authorId: 'acc_x', authorName: '수민' })}
        renderAuthor={(id, info) => {
          seen.push(info)
          return <em>{id}!</em>
        }}
      />,
    )
    expect(html).toContain('<em>acc_x!</em>')
    expect(seen).toEqual([{ kind: 'named', name: '수민', tag: null, deleted: false }])
  })
})

describe('author tag', () => {
  const twins = [
    summary(1, { authorId: 'a', authorName: '수민', authorTag: '4821' }),
    summary(2, { authorId: 'b', authorName: '수민', authorTag: '0097' }),
    summary(3, { authorId: 'c', authorName: '민수', authorTag: '1234' }),
  ]

  it('PostList shows the tag only for names that collide on the screen', () => {
    const html = renderToStaticMarkup(<PostList {...listProps} posts={twins} />)
    expect(html).toContain('#4821')
    expect(html).toContain('#0097')
    expect(html).not.toContain('#1234')
  })

  it('shows no tag when nobody collides', () => {
    const html = renderToStaticMarkup(<PostList {...listProps} posts={twins.slice(1)} />)
    expect(html).not.toContain('#')
  })

  it('tag="always" and tag="never" override the collision rule', () => {
    const always = renderToStaticMarkup(<AuthorName author={twins[2]} tag="always" />)
    expect(always).toContain('#1234')
    const never = renderToStaticMarkup(<AuthorName author={twins[0]} tag="never" collides />)
    expect(never).not.toContain('#')
  })

  it('a comment thread shows tags for two accounts with the same nickname, and not otherwise', () => {
    const same = renderToStaticMarkup(
      <CommentThread
        {...threadProps}
        thread={thread(
          1,
          [comment(2, 1, { authorId: 'b', authorName: '수민', authorTag: '0097' })],
          {
            authorId: 'a',
            authorName: '수민',
            authorTag: '4821',
          },
        )}
      />,
    )
    expect(same).toContain('#4821')
    expect(same).toContain('#0097')
    const apart = renderToStaticMarkup(
      <CommentThread
        {...threadProps}
        thread={thread(
          1,
          [comment(2, 1, { authorId: 'b', authorName: '민수', authorTag: '0097' })],
          {
            authorId: 'a',
            authorName: '수민',
            authorTag: '4821',
          },
        )}
      />,
    )
    expect(apart).not.toContain('#')
  })

  it('a CommentThread also counts the names of the other threads of its page (scopeNames) — BoardComments hands the whole page over', () => {
    const html = renderToStaticMarkup(
      <CommentThread
        {...threadProps}
        scopeNames={new Set([nameKey('수민')])}
        thread={thread(1, [], { authorId: 'a', authorName: '수민', authorTag: '4821' })}
      />,
    )
    expect(html).toContain('#4821')
  })

  it('the name sits in <bdi> so the tag never lands in front of a right-to-left name', () => {
    expect(
      renderToStaticMarkup(<AuthorName author={{ authorId: 'a', authorName: 'שלום' }} />),
    ).toMatch(/<bdi[^>]*>שלום<\/bdi>/)
  })

  it('the action buttons of a comment name the tag too when it is shown (two "수민" must not sound alike)', () => {
    const html = renderToStaticMarkup(
      <CommentThread
        {...threadProps}
        onReply={noop}
        scopeNames={new Set([nameKey('수민')])}
        thread={thread(1, [], { authorId: 'a', authorName: '수민', authorTag: '4821' })}
      />,
    )
    expect(html).toContain('aria-label="Reply: 수민#4821"')
  })

  it('PostDetail shows the tag when told to always', () => {
    const html = renderToStaticMarkup(
      <PostDetail post={detail(1, { authorName: '수민', authorTag: '4821' })} authorTag="always" />,
    )
    expect(html).toContain('#4821')
  })
})
