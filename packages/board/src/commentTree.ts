import type { Comment, CommentWithReplies } from './types'

/** 트리의 한 마디 — `comment` 에는 `replies` 배열이 없다(자식은 `children`) */
export type CommentNode = {
  comment: Comment
  children: CommentNode[]
  /** 모든 자손의 수(직접 자식만이 아니다) — 「답글 N개 더 보기」의 N */
  descendantCount: number
}

/**
 * 서버가 준 「최상위 + 평평한 자손들」을 트리로 바꾼다. 자손은 오래된 순으로 와서 그 순서를 그대로 지킨다.
 * 부모가 목록에 없는 자손(부모가 다른 쪽에 있거나 사라진 경우)은 사라지게 두지 않고 최상위 아래에 붙인다.
 */
export function nestThread(thread: CommentWithReplies): CommentNode {
  const { replies, ...root } = thread
  const nodes = new Map<number, CommentNode>()
  const make = (comment: Comment): CommentNode => ({ comment, children: [], descendantCount: 0 })
  const top = make(root)
  nodes.set(root.id, top)
  for (const reply of replies) nodes.set(reply.id, make(reply))
  for (const reply of replies) {
    const parent = (reply.parentId !== null && nodes.get(reply.parentId)) || top
    parent.children.push(nodes.get(reply.id)!)
  }
  const count = (node: CommentNode): number => {
    node.descendantCount = node.children.reduce((sum, child) => sum + 1 + count(child), 0)
    return node.descendantCount
  }
  count(top)
  return top
}
