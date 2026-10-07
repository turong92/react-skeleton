import { formatInstant } from '@skeleton/time'
import { Badge, Button } from '@skeleton/ui'
import type { ReactNode } from 'react'
import { AuthorName } from './AuthorName'
import { defaultAuthorLabels, type AuthorLabels, type AuthorTagMode } from './authorDisplay'
import type { PostDetail as PostDetailData, PostModeration, PostStatus } from './types'
import styles from './PostDetail.module.css'

/** 글 상세의 글자 — 기본은 영어. 일부만 덮어쓰려면 `labels={{ edit: '수정' }}` */
export type PostDetailLabels = AuthorLabels & {
  edit: string
  delete: string
  pin: string
  unpin: string
  hide: string
  restore: string
  pinned: string
  status: Record<PostStatus, string>
  views: (count: number) => string
  attachments: (count: number) => string
}

const defaultLabels: PostDetailLabels = {
  ...defaultAuthorLabels,
  edit: 'Edit',
  delete: 'Delete',
  pin: 'Pin',
  unpin: 'Unpin',
  hide: 'Hide',
  restore: 'Restore',
  pinned: 'Pinned',
  status: { DRAFT: 'Draft', PUBLISHED: 'Published', HIDDEN: 'Hidden', DELETED: 'Deleted' },
  views: (count) => `Views: ${count}`,
  attachments: (count) => `Attachments: ${count}`,
}

export type PostDetailProps = {
  post: PostDetailData
  /** 반응 줄 자리 — 보통 `<ReactionBar … />` */
  reactions?: ReactNode
  /** 콜백을 주어야 그 단추가 생긴다. 삭제 확인(대화상자)은 부모 몫 */
  onEdit?: () => void
  onDelete?: () => void
  /** 운영자 — 고정/해제 · 숨김/복구 */
  onModerate?: (moderation: PostModeration) => void
  formatTime?: (iso: string) => string
  /** 작성자 꼬리표 — 글 한 건에는 겹칠 상대가 없어 기본은 안 보인다. 보이려면 `always` */
  authorTag?: AuthorTagMode
  labels?: Partial<Omit<PostDetailLabels, 'status'>> & {
    status?: Partial<PostDetailLabels['status']>
  }
}

/** 글 한 건 — 제목은 `h2`(화면의 `h1` 은 `PageHeader`). 본문은 줄바꿈을 지킨다 */
export function PostDetail({
  post,
  reactions,
  onEdit,
  onDelete,
  onModerate,
  formatTime = (iso) => formatInstant(iso),
  labels: input,
  authorTag,
}: PostDetailProps) {
  const labels: PostDetailLabels = {
    ...defaultLabels,
    ...input,
    status: { ...defaultLabels.status, ...input?.status },
  }
  const hidden = post.status === 'HIDDEN'
  const hasActions = onEdit || onDelete || onModerate
  return (
    <article className={styles.post}>
      <header className={styles.header}>
        <h2>{post.title}</h2>
        <div className={styles.meta}>
          {post.pinned && <Badge tone="info">{labels.pinned}</Badge>}
          {post.status !== 'PUBLISHED' && (
            <Badge tone={post.status === 'DRAFT' ? 'neutral' : 'warning'}>
              {labels.status[post.status]}
            </Badge>
          )}
          <AuthorName author={post} labels={labels} tag={authorTag} />
          <time dateTime={post.createdAt}>{formatTime(post.createdAt)}</time>
          <span>{labels.views(post.viewCount)}</span>
          {post.attachmentCount > 0 && <span>{labels.attachments(post.attachmentCount)}</span>}
        </div>
      </header>
      <p className={styles.body}>{post.body}</p>
      {reactions}
      {hasActions && (
        <div className={styles.actions}>
          {onEdit && (
            <Button variant="secondary" size="sm" onClick={onEdit}>
              {labels.edit}
            </Button>
          )}
          {onDelete && (
            <Button variant="danger" size="sm" onClick={onDelete}>
              {labels.delete}
            </Button>
          )}
          {onModerate && (
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onModerate({ pinned: !post.pinned })}
              >
                {post.pinned ? labels.unpin : labels.pin}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onModerate({ status: hidden ? 'PUBLISHED' : 'HIDDEN' })}
              >
                {hidden ? labels.restore : labels.hide}
              </Button>
            </>
          )}
        </div>
      )}
    </article>
  )
}
