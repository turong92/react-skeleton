import type { BoardApi } from './boardApi'
import { useReaction } from './hooks'
import { ReactionBar, type ReactionBarProps } from './ReactionBar'
import type { BoardConfig, PostSummary } from './types'

export type PostReactionBarProps = Pick<
  ReactionBarProps,
  'labels' | 'icons' | 'groupLabel' | 'disabled'
> & {
  api: BoardApi
  boardCode: string
  /** 글 상세(또는 목록 줄) — 개수 · 내 반응은 여기서 읽는다. 누르면 이 데이터가 낙관적으로 바뀐다 */
  post: Pick<PostSummary, 'id' | 'reactionCounts' | 'myReactions'>
  /** 서버 설정(`useBoardConfig`) — 그릴 종류와 모드(`SINGLE`/`PER_TYPE`) */
  config: Pick<BoardConfig, 'reactionTypes' | 'reactionMode'>
}

/** 글의 반응 줄(서버와 이어진 모양) — 종류는 서버 설정이 정하고, 누르면 낙관적으로 바뀌며 실패하면 되돌아간다 */
export function PostReactionBar({ api, boardCode, post, config, ...rest }: PostReactionBarProps) {
  const react = useReaction(api, boardCode, config.reactionMode)
  return (
    <ReactionBar
      {...rest}
      types={config.reactionTypes}
      counts={post.reactionCounts}
      mine={post.myReactions}
      onToggle={(type, active) =>
        react.mutate({ target: { kind: 'post', postId: post.id }, type, active })
      }
    />
  )
}
