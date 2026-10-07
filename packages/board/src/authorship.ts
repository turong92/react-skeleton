import type { ReactNode } from 'react'
import type { Comment, CommentWithReplies } from './types'

/**
 * 「내 것인가」 — 서버가 응답에 싣는 `mine` 이 정본이다. 작성자 id 가 계정과 다른 서버(작성자 프로필)에서는
 * `authorId === currentUserId` 가 늘 거짓이라, `mine` 이 없는 옛 서버일 때만 id 를 비교한다.
 */
export function isOwn(
  item: { mine?: boolean; authorId: string },
  currentUserId: string | undefined,
): boolean {
  return item.mine ?? (currentUserId !== undefined && item.authorId === currentUserId)
}

type Walkable = Comment & { replies?: readonly Walkable[] }

/**
 * 이 스레드에서 내가 **마지막으로** 쓴 댓글의 `authorId`(없으면 undefined). `mine` 이 참인 댓글만 센다 —
 * `mine` 이 없는 옛 서버 응답은 판정하지 않는다. 서버는 최상위 아래에 모든 자손을 평평하게 주지만(`replies`),
 * 중첩돼 와도 따라 내려간다. 같은 시각이면 id 가 큰 쪽.
 */
export function lastOwnAuthorId(
  comments: readonly (Comment | CommentWithReplies)[],
): string | undefined {
  let best: Comment | undefined
  const visit = (items: readonly Walkable[]) => {
    for (const item of items) {
      if (item.mine === true) {
        const newer =
          !best ||
          item.createdAt > best.createdAt ||
          (item.createdAt === best.createdAt && item.id > best.id)
        if (newer) best = item
      }
      if (item.replies) visit(item.replies)
    }
  }
  visit(comments)
  return best?.authorId
}

/** `authorPicker` 렌더 함수가 받는 것 — 보드는 선택기가 무엇인지 모른다(작성자 프로필이든 무엇이든 값은 문자열 id 하나) */
export type AuthorPickerArgs = {
  /** 지금 고른 작성자 id — 없으면 undefined(골라야 보낼 수 있다) */
  value: string | undefined
  /** 바꾼다. 처음 값을 정하는 것도 선택기의 몫이다(effect 에서 불러도 된다) */
  onChange: (authorId: string | undefined) => void
  /** 이 스레드(글의 댓글)에서 내가 마지막으로 쓴 작성자 id — 없으면 undefined. 글쓰기 폼에는 늘 undefined */
  threadAuthorId: string | undefined
  /** 칸 오류 문장이 보이는 중인가 — 선택기가 `aria-invalid` 를 걸 수 있게 */
  invalid: boolean
  /** 보내는 중 */
  disabled: boolean
}
export type AuthorPicker = (args: AuthorPickerArgs) => ReactNode
