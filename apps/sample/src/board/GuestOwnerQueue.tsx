import { ApiRequestError } from '@skeleton/api-client'
import {
  useCommentRevisions,
  useDecideCommentRevision,
  useModerateComment,
  usePendingComments,
  type BoardId,
  type Comment,
  boardKeys,
} from '@skeleton/board'
import { Button, Card, Field, Input, Spinner } from '@skeleton/ui'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useT } from '../i18n'
import { boardApi } from './api'
import { BoardPicture } from './BoardPicture'

/**
 * 비회원이 쓴 글의 주인이 자기 글의 승인 대기 댓글 · 고친 댓글을 글의 비밀로 관리한다(스펙 §3.3) - 로그인 없이.
 * `TOKEN` 방식이면 이 브라우저가 들고 있는 값으로 바로, `PASSWORD` 방식이면 비밀번호를 한 번 입력한다.
 * 비밀이 틀리면(403) 입력 칸으로 돌아가 다시 받는다 - 틀린 비밀을 쥔 채 남지 않는다. 4xx 는 다시 시도하지 않는다(패키지 쿼리 기본값).
 */
export function GuestOwnerQueue({
  code,
  postId,
  token,
}: {
  code: string
  postId: BoardId
  /** `TOKEN` 방식의 비밀 - 있으면 입력 없이 불러온다 */
  token?: string
}) {
  const { t } = useT()
  const [typed, setTyped] = useState('')
  const [entered, setEntered] = useState<string | undefined>(token)
  const client = useQueryClient()
  const keyOf = [
    boardKeys.pendingComments(code, postId, {}),
    boardKeys.commentRevisions(code, postId, {}),
  ]
  // 서버가 비밀을 거절하면(403) 입력 칸으로 돌아간다 - 틀린 값을 쥔 채 남지 않는다 (캐시의 오류를 직접 읽는다: 읽는 쪽이 이 값으로 꺼지므로 훅 결과에 기대면 돌고 돈다). TOKEN 방식은 고칠 입력이 없다
  const rejected = keyOf.some((key) => {
    const error = client.getQueryState(key)?.error
    return error instanceof ApiRequestError && error.apiError.status === 403
  })
  const wrong = rejected && !token
  const secret = wrong ? undefined : entered
  const options = { guestSecret: secret, enabled: !!secret }
  const pending = usePendingComments(boardApi, code, postId, {}, options)
  const edits = useCommentRevisions(boardApi, code, postId, {}, options)
  const moderate = useModerateComment(boardApi, code, postId)
  const decide = useDecideCommentRevision(boardApi, code, postId)
  const forbidden = rejected

  const refresh = () => {
    void pending.refetch()
    void edits.refetch()
  }
  const name = (c: Comment) => c.authorName ?? c.authorId
  const access = (c: Comment, key: string) => () =>
    boardApi
      .commentAttachmentAccess(code, postId, c.id, key, { guestSecret: secret })
      .then((r) => r.url)

  return (
    <Card title={t('board.ownerQueue.title')}>
      {!secret && (
        <form
          onSubmit={(event) => {
            event.preventDefault()
            if (typed) {
              // 이전 시도의 오류를 지우고 새 비밀로 한 번 다시 묻는다
              keyOf.forEach((queryKey) => client.removeQueries({ queryKey }))
              setEntered(typed)
            }
          }}
        >
          <Field label={t('board.ownerQueue.secret')} hint={t('board.ownerQueue.hint')}>
            {(control) => (
              <Input
                {...control}
                type="password"
                autoComplete="off"
                value={typed}
                onChange={(event) => setTyped(event.target.value)}
              />
            )}
          </Field>
          {wrong && <p role="alert">{t('board.ownerQueue.failed')}</p>}
          <Button type="submit">{t('board.ownerQueue.open')}</Button>
        </form>
      )}
      {secret && (pending.isPending || edits.isPending) && !forbidden && (
        <Spinner label={t('common.loading')} />
      )}
      {secret && token && forbidden && <p role="alert">{t('board.ownerQueue.failed')}</p>}
      {pending.data &&
        pending.data.values.length === 0 &&
        (edits.data?.values.length ?? 0) === 0 && <p>{t('board.ownerQueue.empty')}</p>}
      {pending.data && pending.data.values.length > 0 && (
        <ul data-testid="owner-queue">
          {pending.data.values.map((comment) => (
            <li key={comment.id}>
              <strong>{name(comment)}</strong>
              <p>{comment.body}</p>
              {(comment.attachments ?? []).map((key) => (
                <BoardPicture
                  key={key}
                  url={comment.attachmentUrls?.[key]}
                  access={access(comment, key)}
                />
              ))}
              <Button
                size="sm"
                aria-label={`${t('board.comments.approve')}: ${name(comment)}`}
                onClick={() =>
                  moderate.mutate(
                    { id: comment.id, status: 'PUBLISHED', guestSecret: secret },
                    { onSuccess: refresh },
                  )
                }
              >
                {t('board.comments.approve')}
              </Button>
              <Button
                size="sm"
                variant="danger"
                aria-label={`${t('board.comments.hide')}: ${name(comment)}`}
                onClick={() =>
                  moderate.mutate(
                    { id: comment.id, status: 'HIDDEN', guestSecret: secret },
                    { onSuccess: refresh },
                  )
                }
              >
                {t('board.comments.hide')}
              </Button>
            </li>
          ))}
        </ul>
      )}
      {edits.data && edits.data.values.length > 0 && (
        <ul data-testid="owner-edits">
          {edits.data.values.map((comment) => {
            const revision = comment.pendingRevision
            if (!revision) return null
            return (
              <li key={comment.id}>
                <strong>{name(comment)}</strong>
                <p>
                  {t('board.revision.current')}: {comment.body}
                </p>
                <p>
                  {t('board.revision.edited')}: {revision.body}
                </p>
                {revision.attachments.map((key) => (
                  <BoardPicture key={key} access={access(comment, key)} />
                ))}
                {[
                  ['APPROVE', 'board.revision.approve', 'primary'],
                  ['REJECT', 'board.revision.reject', 'danger'],
                ].map(([decision, label, variant]) => (
                  <Button
                    key={decision}
                    size="sm"
                    variant={variant as 'primary' | 'danger'}
                    aria-label={`${t(label as 'board.revision.approve')}: ${name(comment)}`}
                    onClick={() =>
                      decide.mutate(
                        {
                          id: comment.id,
                          decision: decision as 'APPROVE' | 'REJECT',
                          submittedAt: revision.submittedAt,
                          guestSecret: secret,
                        },
                        { onSuccess: refresh },
                      )
                    }
                  >
                    {t(label as 'board.revision.approve')}
                  </Button>
                ))}
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
