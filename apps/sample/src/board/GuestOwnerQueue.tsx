import { useModerateComment, usePendingComments, type BoardId } from '@skeleton/board'
import { Button, Card, Field, Input, Spinner } from '@skeleton/ui'
import { useState } from 'react'
import { useT } from '../i18n'
import { boardApi } from './api'

/**
 * 비회원이 쓴 글의 주인이 자기 글의 승인 대기 댓글을 글의 비밀로 관리한다(스펙 §3.3) - 로그인 없이.
 * `TOKEN` 방식이면 이 브라우저가 들고 있는 값으로 바로, `PASSWORD` 방식이면 비밀번호를 한 번 입력한다.
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
  const [secret, setSecret] = useState<string | undefined>(token)
  const pending = usePendingComments(
    boardApi,
    code,
    postId,
    {},
    { guestSecret: secret, enabled: !!secret },
  )
  const moderate = useModerateComment(boardApi, code, postId)

  return (
    <Card title={t('board.ownerQueue.title')}>
      {!secret && (
        <form
          onSubmit={(event) => {
            event.preventDefault()
            if (typed) setSecret(typed)
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
          <Button type="submit">{t('board.ownerQueue.open')}</Button>
        </form>
      )}
      {secret && pending.isPending && <Spinner label={t('common.loading')} />}
      {secret && pending.isError && <p role="alert">{t('board.ownerQueue.failed')}</p>}
      {pending.data && pending.data.values.length === 0 && <p>{t('board.ownerQueue.empty')}</p>}
      {pending.data && pending.data.values.length > 0 && (
        <ul data-testid="owner-queue">
          {pending.data.values.map((comment) => (
            <li key={comment.id}>
              <strong>{comment.authorName ?? comment.authorId}</strong>
              <p>{comment.body}</p>
              <Button
                size="sm"
                aria-label={`${t('board.comments.approve')}: ${comment.authorName ?? comment.authorId}`}
                onClick={() =>
                  moderate.mutate(
                    { id: comment.id, status: 'PUBLISHED', guestSecret: secret },
                    { onSuccess: () => void pending.refetch() },
                  )
                }
              >
                {t('board.comments.approve')}
              </Button>
              <Button
                size="sm"
                variant="danger"
                aria-label={`${t('board.comments.hide')}: ${comment.authorName ?? comment.authorId}`}
                onClick={() =>
                  moderate.mutate(
                    { id: comment.id, status: 'HIDDEN', guestSecret: secret },
                    { onSuccess: () => void pending.refetch() },
                  )
                }
              >
                {t('board.comments.hide')}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
