import { AuthorName } from './AuthorName'
import { isOwn } from './authorship'
import { nameKey, resolveAuthor, showsTag } from './authorDisplay'
import { formatInstant } from '@skeleton/time'
import { Badge, Button } from '@skeleton/ui'
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
  /** 이 스레드에서 서로 다른 작성자 id 가 같이 쓰는 닉네임 */
  collidingNames: ReadonlySet<string>
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
  const waiting = comment.status === 'PENDING'
  const guestOwned = comment.authorGuest === true && ctx.ownGuestIds?.has(comment.id) === true
  // 서버는 비회원을 모른다(`mine` 은 늘 false) — 이 브라우저가 비회원으로 쓴 댓글은 화면이 자기가 가진 것으로 안다
  const own = isOwn(comment, ctx.currentUserId) || guestOwned
  const manage = ctx.canModerate === true || ctx.canManageComments === true
  const revision = comment.pendingRevision ?? undefined
  const resolved = resolveAuthor(comment, L)
  const author = ctx.renderAuthor ? (
    <strong>
      {ctx.renderAuthor(comment.authorId, { ...resolved, deleted: resolved.kind === 'deleted' })}
    </strong>
  ) : (
    <AuthorName
      author={comment}
      labels={L}
      tag={ctx.authorTag}
      collides={ctx.collidingNames.has(nameKey(resolved.name))}
    />
  )
  const format = ctx.formatTime ?? ((iso: string) => formatInstant(iso))
  // 꼬리표가 보일 때는 단추 이름에도 넣는다 — 같은 닉네임의 두 사람이 같은 소리가 나지 않게
  const tagged =
    resolved.tag &&
    showsTag(
      ctx.authorTag ?? 'collision',
      ctx.collidingNames.has(nameKey(resolved.name)),
      resolved.tag,
    )
      ? `${resolved.name}#${resolved.tag}`
      : resolved.name
  const named = (label: string) => `${label}: ${tagged}`
  const collapsible = children.length > 0 && children[0].comment.depth >= ctx.collapseFromDepth
  const open = !collapsible || ctx.expanded.has(comment.id)
  const reactionTypes = ctx.reactionTypes ?? []

  const action = (label: string, onClick: () => void, variant: 'ghost' | 'danger' = 'ghost') => (
    <Button size="sm" variant={variant} aria-label={named(label)} onClick={onClick}>
      {label}
    </Button>
  )

  return (
    <div className={styles.comment} data-depth={comment.depth} data-status={comment.status}>
      <div className={styles.head}>
        {author}
        <time dateTime={comment.createdAt} className={styles.time}>
          {format(comment.createdAt)}
        </time>
        {waiting && <Badge tone="warning">{L.pending}</Badge>}
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
          guestSecretFor={guestOwned ? ctx.guest : undefined}
          guestLabels={L}
          attachmentPicker={ctx.attachmentPicker}
          maxAttachments={ctx.maxAttachments}
          initialAttachments={comment.attachments ?? []}
          onCancel={() => ctx.setEditing(null)}
          onSubmit={async (body, _authorId, extra) => {
            await (extra ? ctx.onEdit?.(comment.id, body, extra) : ctx.onEdit?.(comment.id, body))
            ctx.setEditing(null)
          }}
        />
      ) : (
        <p className={comment.body !== null ? styles.body : styles.placeholder}>
          {comment.body !== null
            ? comment.body
            : comment.status === 'DELETED'
              ? L.deleted
              : L.hidden}
        </p>
      )}
      {comment.body !== null && (comment.attachments?.length ?? 0) > 0 && (
        <ul className={styles.attachments} aria-label={L.attachments}>
          {comment.attachments?.map((key) => (
            <li key={key}>{ctx.renderAttachment ? ctx.renderAttachment(key, comment) : key}</li>
          ))}
        </ul>
      )}
      {waiting && own && <p className={styles.note}>{L.pendingNote}</p>}
      {revision && (own || manage) && (
        <div className={styles.revision} data-testid="comment-revision">
          <p className={styles.note}>{manage ? L.revisionReview : L.revisionWaiting}</p>
          {manage && (
            <dl className={styles.compare}>
              <dt>{L.revisionCurrent}</dt>
              <dd>{comment.body}</dd>
              <dt>{L.revisionEdited}</dt>
              <dd>{revision.body}</dd>
            </dl>
          )}
          {!manage && <p className={styles.body}>{revision.body}</p>}
          {manage && ctx.onDecideRevision && (
            <div className={styles.actions}>
              {action(L.approveEdit, () =>
                ctx.onDecideRevision?.(comment.id, 'APPROVE', revision.submittedAt),
              )}
              {action(
                L.rejectEdit,
                () => ctx.onDecideRevision?.(comment.id, 'REJECT', revision.submittedAt),
                'danger',
              )}
            </div>
          )}
        </div>
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
        {(published || waiting) &&
          own &&
          ctx.onEdit &&
          action(L.edit, () => ctx.setEditing(comment.id))}
        {comment.status !== 'DELETED' &&
          (own || ctx.canModerate) &&
          ctx.onDelete &&
          action(L.delete, () => ctx.onDelete?.(comment.id), 'danger')}
        {manage &&
          ctx.onModerate &&
          waiting &&
          action(L.approve, () => ctx.onModerate?.(comment.id, 'PUBLISHED'))}
        {manage &&
          ctx.onModerate &&
          (published || waiting) &&
          action(L.hide, () => ctx.onModerate?.(comment.id, 'HIDDEN'))}
        {manage &&
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
          authorPicker={ctx.authorPicker}
          authorRequired={ctx.authorRequired}
          authorRequiredMessage={L.authorRequired}
          authorUnsettledMessage={L.authorUnsettled}
          threadAuthorId={ctx.threadAuthorId}
          threadLoading={ctx.threadLoading}
          guest={ctx.guest}
          guestLabels={L}
          attachmentPicker={ctx.attachmentPicker}
          maxAttachments={ctx.maxAttachments}
          onCancel={() => ctx.setReplyingTo(null)}
          onSubmit={async (body, authorId, extra) => {
            await (extra
              ? ctx.onReply?.(comment.id, body, authorId, extra)
              : authorId
                ? ctx.onReply?.(comment.id, body, authorId)
                : ctx.onReply?.(comment.id, body))
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
