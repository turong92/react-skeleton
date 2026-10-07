import type { QueryKey } from '@tanstack/react-query'
import { Alert, Button, ConfirmDialog, Field, Input, Spinner } from '@skeleton/ui'
import { useState, type FormEvent } from 'react'
import type { AuthorProfileApi } from './authorProfileApi'
import { nameProblem, profileFormProblem } from './errors'
import {
  useAuthorProfileConfig,
  useAuthorProfiles,
  useCreateAuthorProfile,
  useRemoveAuthorProfile,
  useRenameAuthorProfile,
} from './hooks'
import { mergeLabels, type AuthorProfileLabels } from './labels'
import { ProfileRow } from './ProfileRow'
import { profileDisplay, type AuthorProfile } from './types'
import styles from './AuthorProfileManager.module.css'

export type AuthorProfileManagerProps = {
  api: AuthorProfileApi
  labels?: Partial<AuthorProfileLabels>
  /**
   * 이름 바꾸기 · 지우기가 끝나면 다시 가져올 다른 캐시 — 작성자 이름은 읽을 때 조회되므로 글 · 댓글 캐시가 걸린다(예: 게시판 `[['board']]`).
   * 안 주면 이 패키지의 목록만 갱신한다.
   */
  alsoInvalidate?: readonly QueryKey[]
}

/**
 * 프로필 관리 — 목록 · 추가 · 이름 바꾸기 · 삭제(`ConfirmDialog`: 되돌릴 수 없고 글은 「삭제된 사용자」로 남는다는 문구는 `labels.deleteDescription`).
 * 서버의 답(NAME_TAKEN · LIMIT_REACHED · RATE_LIMITED · 이름 칸 오류)은 폼이 제자리에서 말한다 — 앱의 전역 오류 토스트는 `isAuthorProfileFormError` 인 것을 건너뛴다.
 * 상한(`config.maxPerAccount`)에 닿으면 추가가 꺼지고 이유를 먼저 알려 준다. 계정 id · 프로필 id 는 화면 어디에도 없다.
 */
export function AuthorProfileManager({
  api,
  labels: given,
  alsoInvalidate,
}: AuthorProfileManagerProps) {
  const labels = mergeLabels(given)
  const list = useAuthorProfiles(api)
  const configQuery = useAuthorProfileConfig(api)
  const create = useCreateAuthorProfile(api)
  const rename = useRenameAuthorProfile(api, alsoInvalidate)
  const remove = useRemoveAuthorProfile(api, alsoInvalidate)
  const [name, setName] = useState('')
  const [local, setLocal] = useState<string>()
  // 확인 창은 한 번 열린 뒤로 계속 달아 둔다(닫을 때 포커스가 연 단추로 돌아가려면 창이 남아 있어야 한다)
  const [target, setTarget] = useState<AuthorProfile>()
  const [confirming, setConfirming] = useState(false)

  const profiles = list.data
  const config = configQuery.data
  if (!profiles || !config) {
    if (list.isError || configQuery.isError)
      return (
        <Button
          variant="secondary"
          onClick={() => {
            void list.refetch()
            void configQuery.refetch()
          }}
        >
          {labels.loadFailed}
        </Button>
      )
    return <Spinner label={labels.loading} />
  }

  const atLimit = profiles.length >= config.maxPerAccount
  const problem = profileFormProblem(create.error, labels, config)
  const removeProblem = profileFormProblem(remove.error, labels, config)

  async function add(event: FormEvent) {
    event.preventDefault()
    const found = nameProblem(name, labels, config!)
    setLocal(found)
    if (found) return
    try {
      await create.mutateAsync({ name: name.trim() })
      setName('')
    } catch {
      // 서버의 답은 create.error 로 폼이 말한다
    }
  }

  async function confirmRemove() {
    if (!target) return
    try {
      await remove.mutateAsync(target.id)
      setConfirming(false)
    } catch {
      // 오류는 창 안에서 말한다(NOT_FOUND 는 이미 없다는 말 — 목록은 곧 갱신된다)
    }
  }

  return (
    <div className={styles.root}>
      <p className={styles.count}>{labels.count(profiles.length, config.maxPerAccount)}</p>
      {profiles.length === 0 ? (
        <p className={styles.note}>{labels.empty}</p>
      ) : (
        <ul className={styles.list} aria-label={labels.listLabel}>
          {profiles.map((profile) => (
            <ProfileRow
              key={profile.id}
              profile={profile}
              labels={labels}
              config={config}
              rename={rename}
              onDelete={(picked) => {
                remove.reset()
                setTarget(picked)
                setConfirming(true)
              }}
            />
          ))}
        </ul>
      )}
      <form className={styles.form} onSubmit={add} aria-label={labels.add}>
        {atLimit && <p className={styles.note}>{labels.limitReached(config.maxPerAccount)}</p>}
        {problem?.where === 'form' && !atLimit && <Alert tone="danger">{problem.message}</Alert>}
        <Field
          label={labels.nameLabel}
          hint={labels.nameHint(config.nameMaxLength)}
          error={local ?? (problem?.where === 'name' ? problem.message : undefined)}
        >
          {(control) => (
            <Input
              {...control}
              autoComplete="off"
              disabled={atLimit}
              value={name}
              onChange={(event) => {
                setName(event.target.value)
                setLocal(undefined)
                if (create.error) create.reset()
              }}
            />
          )}
        </Field>
        <div>
          <Button
            type="submit"
            disabled={atLimit}
            loading={create.isPending}
            loadingLabel={labels.adding}
          >
            {labels.add}
          </Button>
        </div>
      </form>
      {target && (
        <ConfirmDialog
          open={confirming}
          onClose={() => setConfirming(false)}
          onConfirm={() => void confirmRemove()}
          title={labels.deleteTitle(profileDisplay(target))}
          description={
            <>
              <p>{labels.deleteDescription(profileDisplay(target))}</p>
              {removeProblem && <Alert tone="danger">{removeProblem.message}</Alert>}
            </>
          }
          confirmLabel={labels.deleteConfirm}
          cancelLabel={labels.deleteCancel}
          closeLabel={labels.deleteClose}
          busy={remove.isPending}
        />
      )}
    </div>
  )
}
