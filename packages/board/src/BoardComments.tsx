import { Button, Card, Dialog, EmptyState, Field, Pagination, Select, Spinner } from '@skeleton/ui'
import { useState } from 'react'
import type { BoardApi } from './boardApi'
import { resolveBoardCommentsLabels, type BoardCommentsLabelsInput } from './boardCommentsLabels'
import { CommentForm } from './CommentForm'
import { CommentThread } from './CommentThread'
import type { CommentOptions } from './commentThreadContext'
import {
  useComments,
  useCreateComment,
  useModerateComment,
  useReaction,
  useRemoveComment,
  useUpdateComment,
} from './hooks'
import { COMMENT_SORTS, type BoardConfig, type BoardId, type CommentSort } from './types'
import styles from './BoardComments.module.css'

export type BoardCommentsProps = Omit<
  CommentOptions,
  | 'maxDepth'
  | 'commentMaxLength'
  | 'canModerate'
  | 'reactionTypes'
  | 'labels'
  | 'onReply'
  | 'onEdit'
  | 'onDelete'
  | 'onModerate'
  | 'onReact'
> & {
  api: BoardApi
  boardCode: string
  postId: BoardId
  /** 서버 설정(`useBoardConfig` 의 data) — 깊이 · 길이 한도 · 운영자 여부 · 반응 종류와 모드가 여기서 온다 */
  config: BoardConfig
  /** 최상위 댓글 한 쪽의 크기(기본 20, 서버의 `maxPageSize` 이하) */
  pageSize?: number
  /** false 면 새 댓글 칸이 없다(글이 숨김 · 초안일 때) */
  commentable?: boolean
  labels?: BoardCommentsLabelsInput
}

/**
 * 댓글 영역(서버와 이어진 모양) — 최상위 댓글 쪽 · 정렬 · 새 댓글 · 답글 · 수정 · 삭제(확인 대화상자) · 운영자 숨김 · 반응(낙관적).
 * 오류 토스트는 앱의 QueryClient 전역 핸들러가 한다. 먼저 `CommentThread` 가 보이기만 하는 부분이다.
 */
export function BoardComments({
  api,
  boardCode,
  postId,
  config,
  pageSize = 20,
  commentable = true,
  labels: input,
  ...options
}: BoardCommentsProps) {
  const labels = resolveBoardCommentsLabels(input)
  const [sort, setSort] = useState<CommentSort>('oldest')
  const [page, setPage] = useState(0)
  const [deleting, setDeleting] = useState<BoardId | null>(null)
  const comments = useComments(api, boardCode, postId, { sort, page, size: pageSize })
  const create = useCreateComment(api, boardCode, postId)
  const update = useUpdateComment(api, boardCode, postId)
  const remove = useRemoveComment(api, boardCode, postId)
  const moderate = useModerateComment(api, boardCode, postId)
  const react = useReaction(api, boardCode, config.reactionMode)

  return (
    <Card title={labels.heading}>
      <div className={styles.body}>
        {commentable && (
          <CommentForm
            clearOnSubmit
            label={labels.newComment}
            submitLabel={labels.postComment}
            maxLength={config.commentMaxLength}
            requiredMessage={labels.required}
            tooLongMessage={labels.tooLong}
            onSubmit={(body) => create.mutateAsync({ input: { body } })}
          />
        )}
        <Field label={labels.sort}>
          {(control) => (
            <Select
              {...control}
              value={sort}
              onChange={(event) => {
                setSort(event.target.value as CommentSort)
                setPage(0)
              }}
            >
              {COMMENT_SORTS.map((value) => (
                <option key={value} value={value}>
                  {labels.sorts[value]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        {comments.isPending && <Spinner label={labels.loading} />}
        {comments.isError && (
          <div role="alert" className={styles.error}>
            <p>{labels.loadError}</p>
            <div>
              <Button variant="secondary" onClick={() => void comments.refetch()}>
                {labels.retry}
              </Button>
            </div>
          </div>
        )}
        {comments.data && comments.data.values.length === 0 && (
          <EmptyState headingLevel={3} title={labels.empty} />
        )}
        {comments.data && (
          <ul className={styles.threads}>
            {comments.data.values.map((thread) => (
              <li key={thread.id}>
                <CommentThread
                  {...options}
                  thread={thread}
                  labels={labels}
                  maxDepth={config.maxCommentDepth}
                  commentMaxLength={config.commentMaxLength}
                  canModerate={config.canModerate}
                  reactionTypes={config.reactionTypes}
                  onReply={
                    commentable
                      ? (parentId, body) => create.mutateAsync({ input: { body, parentId } })
                      : undefined
                  }
                  onEdit={(id, body) => update.mutateAsync({ id, body })}
                  onDelete={setDeleting}
                  onModerate={(id, status) => moderate.mutate({ id, status })}
                  onReact={(id, type, active) =>
                    react.mutate({
                      target: { kind: 'comment', postId, commentId: id },
                      type,
                      active,
                    })
                  }
                />
              </li>
            ))}
          </ul>
        )}
        {comments.data && (
          <Pagination
            page={comments.data.pagination.page}
            totalPages={comments.data.pagination.totalPages}
            onPageChange={setPage}
            label={labels.pagination.label}
            previousLabel={labels.pagination.previous}
            nextLabel={labels.pagination.next}
            pageLabel={labels.pagination.page}
          />
        )}
      </div>
      <Dialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title={labels.confirmDeleteTitle}
        closeLabel={labels.close}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleting(null)}>
              {labels.cancel}
            </Button>
            <Button
              variant="danger"
              loading={remove.isPending}
              onClick={() => {
                if (deleting !== null)
                  void remove.mutateAsync(deleting).then(
                    () => setDeleting(null),
                    () => setDeleting(null),
                  )
              }}
            >
              {labels.confirmDelete}
            </Button>
          </>
        }
      >
        <p>{labels.confirmDeleteBody}</p>
      </Dialog>
    </Card>
  )
}
