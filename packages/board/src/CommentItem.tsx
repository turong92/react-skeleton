import { formatInstant } from '@skeleton/time'
import { Button } from '@skeleton/ui'
import type { CommentLabels } from './commentLabels'
import { CommentForm } from './CommentForm'
import type { CommentNode } from './commentTree'
import type { CommentOptions } from './commentThreadContext'
import { ReactionBar } from './ReactionBar'
import type { BoardId } from './types'
import styles from './CommentItem.module.css'

/** `CommentThread` 가 쥔 열림 상태 + 설정 — 아래로 그대로 내려간다 */
export type ThreadContext = CommentOptions & {
  labels: CommentLabels
  collapseFromDepth: number
  replyingTo: BoardId | null
  editing: BoardId | null
  expanded: ReadonlySet<BoardId>
  setReplyingTo: (id: BoardId | null) => void
  setEditing: (id: BoardId | null) => void
  toggleExpanded: (id: BoardId) => void
  /** 이 댓글의 답글을 펼친다(방금 단 답글이 접힌 칸에 숨지 않게) */
  expand: (id: BoardId) => void
}

/** 댓글 하나 + 그 아래 답글(재귀). 접힌 답글은 단추 하나 */
export function CommentItem({ node, ctx }: { node: CommentNode; ctx: ThreadContext }) {
  const { comment, children } = node
  const { labels: L } = ctx
  const published = comment.status === 'PUBLISHED'
  const own = ctx.currentUserId !== undefined && comment.authorId === ctx.currentUserId
  const author = ctx.renderAuthor ? ctx.renderAuthor(comment.authorId) : comment.authorId
  const format = ctx.formatTime ?? ((iso: string) => formatInstant(iso))
  const named = (label: string) => `${label}: ${comment.authorId}`
  const collapsible = children.length > 0 && children[0].comment.depth >= ctx.collapseFromDepth
  const open = !collapsible || ctx.expanded.has(comment.id)
  const reactionTypes = ctx.reactionTypes ?? []

  const action = (label: string, onClick: () => void) => (
    <Button size="sm" variant="ghost" aria-label={named(label)} onClick={onClick}>
      {label}
    </Button>
  )

  return (
    <div className={styles.comment} data-depth={comment.depth} data-status={comment.status}>
      <div className={styles.head}>
        <strong>{author}</strong>
        <time dateTime={comment.createdAt} className={styles.time}>
          {format(comment.createdAt)}
        </time>
      </div>

      {ctx.editing === comment.id ? (
        <CommentForm
          autoFocus
          label={L.editField}
          submitLabel={L.save}
          cancelLabel={L.cancel}
          initialValue={comment.body ?? ''}
          maxLength={ctx.commentMaxLength}
          requiredMessage={L.required}
          tooLongMessage={L.tooLong}
          onCancel={() => ctx.setEditing(null)}
          onSubmit={async (body) => {
            await ctx.onEdit?.(comment.id, body)
            ctx.setEditing(null)
          }}
        />
      ) : (
        <p className={published ? styles.body : styles.placeholder}>
          {published ? comment.body : comment.status === 'DELETED' ? L.deleted : L.hidden}
        </p>
      )}

      {published && reactionTypes.length > 0 && (
        <ReactionBar
          types={reactionTypes}
          counts={comment.reactionCounts}
          mine={comment.myReactions}
          labels={ctx.reactionLabels}
          icons={ctx.reactionIcons}
          groupLabel={L.reactionGroup}
          disabled={!ctx.onReact}
          onToggle={(type, active) => ctx.onReact?.(comment.id, type, active)}
        />
      )}

      <div className={styles.actions}>
        {published &&
          ctx.onReply &&
          comment.depth < ctx.maxDepth &&
          action(L.reply, () => ctx.setReplyingTo(comment.id))}
        {published && own && ctx.onEdit && action(L.edit, () => ctx.setEditing(comment.id))}
        {comment.status !== 'DELETED' &&
          (own || ctx.canModerate) &&
          ctx.onDelete &&
          action(L.delete, () => ctx.onDelete?.(comment.id))}
        {ctx.canModerate &&
          ctx.onModerate &&
          published &&
          action(L.hide, () => ctx.onModerate?.(comment.id, 'HIDDEN'))}
        {ctx.canModerate &&
          ctx.onModerate &&
          comment.status === 'HIDDEN' &&
          action(L.restore, () => ctx.onModerate?.(comment.id, 'PUBLISHED'))}
      </div>

      {ctx.replyingTo === comment.id && (
        <CommentForm
          autoFocus
          label={L.replyField}
          submitLabel={L.postReply}
          cancelLabel={L.cancel}
          maxLength={ctx.commentMaxLength}
          requiredMessage={L.required}
          tooLongMessage={L.tooLong}
          onCancel={() => ctx.setReplyingTo(null)}
          onSubmit={async (body) => {
            await ctx.onReply?.(comment.id, body)
            ctx.expand(comment.id)
            ctx.setReplyingTo(null)
          }}
        />
      )}

      {collapsible && (
        <Button
          size="sm"
          variant="ghost"
          aria-expanded={open}
          onClick={() => ctx.toggleExpanded(comment.id)}
        >
          {open ? L.hideReplies : L.showReplies(node.descendantCount)}
        </Button>
      )}
      {open && children.length > 0 && (
        <ul className={styles.replies}>
          {children.map((child) => (
            <li key={child.comment.id}>
              <CommentItem node={child} ctx={ctx} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
