import type { QueryKey } from '@tanstack/react-query'
import { Alert, Button, ConfirmDialog, Spinner } from '@skeleton/ui'
import { useEffect, useRef, useState } from 'react'
import type { AuthorProfileApi } from './authorProfileApi'
import { AuthorProfileAddForm } from './AuthorProfileAddForm'
import { profileFormProblem } from './errors'
import {
  useAuthorProfileConfig,
  useAuthorProfiles,
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
  /**
   * 삭제 확인 창을 열기 직전에 불린다 — `false` 를 돌려주면 창을 열지 않는다. 확인 창은 네이티브 모달이라 그 안에서 막힌 쓰기(예: 이메일 등록이 필요해 403)의 막 화면이
   * 창 **밑**에 깔려 눌리지 않는다 - 막힐 일은 창을 열기 전에 푼다
   */
  beforeRemove?: () => boolean
}

/**
 * 프로필 관리 — 목록 · 추가 · 이름 바꾸기 · 삭제(`ConfirmDialog`: 되돌릴 수 없고 글은 「삭제된 사용자」로 남는다는 문구는 `labels.deleteDescription`).
 * 서버의 답(NAME_TAKEN · LIMIT_REACHED · RATE_LIMITED · 이름 칸 오류)은 폼이 제자리에서 말한다 — 앱의 전역 오류 토스트는 `isAuthorProfileFormError` 인 것을 건너뛴다.
 * 상한(`config.maxPerAccount`)에 닿으면 추가가 꺼지고 이유를 먼저 알려 준다(그 문장은 추가 칸 · 단추의 `aria-describedby`). 계정 id · 프로필 id 는 화면 어디에도 없다.
 * 이름 바꾸기는 한 번에 한 줄만 연다(오류 · 진행이 다른 줄로 새지 않는다). 포커스: 저장 · 취소 뒤에는 그 줄의 「이름 바꾸기」, 삭제 뒤에는 그 자리의 다음 줄(없으면 새 이름 칸).
 * 추가 폼은 `AuthorProfileAddForm`(네트워크 실패 뒤 같은 이름을 다시 보낼 때 같은 `Idempotency-Key`).
 */
export function AuthorProfileManager({
  api,
  labels: given,
  alsoInvalidate,
  beforeRemove,
}: AuthorProfileManagerProps) {
  const labels = mergeLabels(given)
  const list = useAuthorProfiles(api)
  const configQuery = useAuthorProfileConfig(api)
  const rename = useRenameAuthorProfile(api, alsoInvalidate)
  const remove = useRemoveAuthorProfile(api, alsoInvalidate)
  // 확인 창은 한 번 열린 뒤로 계속 달아 둔다(닫을 때 포커스가 연 단추로 돌아가려면 창이 남아 있어야 한다)
  const [target, setTarget] = useState<AuthorProfile>()
  const [confirming, setConfirming] = useState(false)
  const [editingId, setEditingId] = useState<string>()
  const rootRef = useRef<HTMLDivElement>(null)
  // 삭제 뒤 포커스를 옮길 자리(지운 줄이 있던 순서) — 목록이 갱신돼 그 줄이 사라진 뒤에 한 번 쓴다
  const focusAfterRemoval = useRef<{ id: string; index: number }>(undefined)

  const profiles = list.data
  const config = configQuery.data

  useEffect(() => {
    const wanted = focusAfterRemoval.current
    if (!wanted || confirming || !profiles) return
    focusAfterRemoval.current = undefined // 한 번뿐 — 지우지 못하고 닫았다면 포커스는 창이 연 단추로 돌아간다
    if (profiles.some((profile) => profile.id === wanted.id)) return
    const rows = rootRef.current?.querySelectorAll<HTMLElement>('[data-profile-row]')
    const next = rows?.[wanted.index]?.querySelector<HTMLElement>('[data-rename]')
    ;(next ?? rootRef.current?.querySelector<HTMLElement>('[data-new-name]'))?.focus()
  }, [profiles, confirming])

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
  // 이름을 바꾸던 줄이 그사이 사라졌다(다른 탭에서 지움) — 줄과 함께 오류 문장도 사라지지 않게 목록 위에서 말한다
  const renameOrphan =
    editingId !== undefined && !profiles.some((profile) => profile.id === editingId)
      ? profileFormProblem(rename.error, labels, config)
      : undefined
  const removeProblem = profileFormProblem(remove.error, labels, config)

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
    <div ref={rootRef} className={styles.root}>
      <p className={styles.count}>{labels.count(profiles.length, config.maxPerAccount)}</p>
      {renameOrphan && <Alert tone="danger">{renameOrphan.message}</Alert>}
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
              editing={editingId === profile.id}
              onEdit={() => setEditingId(profile.id)}
              onClose={() => setEditingId(undefined)}
              onDelete={(picked) => {
                if (beforeRemove && !beforeRemove()) return
                remove.reset()
                rename.reset() // 사라진 줄의 낡은 오류 알림을 거둔다
                focusAfterRemoval.current = {
                  id: picked.id,
                  index: profiles.findIndex((p) => p.id === picked.id),
                }
                setTarget(picked)
                setConfirming(true)
              }}
            />
          ))}
        </ul>
      )}
      <AuthorProfileAddForm
        api={api}
        labels={labels}
        config={config}
        atLimit={atLimit}
        onAdd={() => rename.reset()}
      />
      {target && (
        <ConfirmDialog
          open={confirming}
          onClose={() => setConfirming(false)}
          onConfirm={() => void confirmRemove()}
          title={labels.deleteTitle(profileDisplay(target, labels.unnamed))}
          description={
            <>
              <p>{labels.deleteDescription(profileDisplay(target, labels.unnamed))}</p>
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
