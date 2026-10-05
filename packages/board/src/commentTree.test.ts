import { describe, expect, it } from 'vitest'
import { nestThread, type CommentNode } from './commentTree'
import type { Comment, CommentWithReplies } from './types'

const comment = (id: number, parentId: number | null, depth: number): Comment => ({
  id,
  postId: 1,
  parentId,
  rootId: 1,
  depth,
  authorId: 'u1',
  body: `comment ${id}`,
  status: 'PUBLISHED',
  reactionCounts: {},
  myReactions: [],
  replyCount: 0,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
})
const thread = (...replies: Comment[]): CommentWithReplies => ({ ...comment(1, null, 0), replies })
const ids = (nodes: CommentNode[]) => nodes.map((node) => node.comment.id)

describe('nestThread — the flat list of descendants becomes a tree', () => {
  it('a thread without replies is one node without children', () => {
    const tree = nestThread(thread())
    expect(tree.comment.id).toBe(1)
    expect(tree.children).toEqual([])
    expect(tree.descendantCount).toBe(0)
  })

  it('puts each reply under its parent, keeping the order it was given (oldest first)', () => {
    const tree = nestThread(
      thread(
        comment(2, 1, 1),
        comment(3, 1, 1),
        comment(4, 2, 2),
        comment(5, 3, 2),
        comment(6, 2, 2),
      ),
    )
    expect(ids(tree.children)).toEqual([2, 3])
    expect(ids(tree.children[0].children)).toEqual([4, 6])
    expect(ids(tree.children[1].children)).toEqual([5])
  })

  it('counts every descendant at every node, not just the direct children', () => {
    const tree = nestThread(thread(comment(2, 1, 1), comment(3, 2, 2), comment(4, 2, 2)))
    expect(tree.descendantCount).toBe(3)
    expect(tree.children[0].descendantCount).toBe(2)
    expect(tree.children[0].children[0].descendantCount).toBe(0)
  })

  it('a reply whose parent is not in the list hangs from the root instead of vanishing', () => {
    const tree = nestThread(thread(comment(2, 999, 1)))
    expect(ids(tree.children)).toEqual([2])
  })

  it('the root node does not carry its own replies array into the tree', () => {
    const tree = nestThread(thread(comment(2, 1, 1)))
    expect('replies' in tree.comment).toBe(false)
  })
})
