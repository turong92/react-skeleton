import { Alert, Button, Field, Input } from '@skeleton/ui'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { nameProblem, profileFormProblem } from './errors'
import type { AuthorProfileLabels } from './labels'
import { profileDisplay, type AuthorProfile, type AuthorProfileConfig } from './types'
import styles from './AuthorProfileManager.module.css'

type RenameMutation = {
  mutateAsync: (vars: { id: string; name: string }) => Promise<unknown>
  isPending: boolean
  error: unknown
  reset: () => void
}

/**
 * 목록의 한 줄 — `이름#꼬리표`(없으면 그것 없이) · 이름 바꾸기(제자리 폼) · 삭제(요청만, 확인 창은 목록이 연다).
 * 편집 중인 줄은 목록이 하나만 정한다(`editing`) — 오류 · 진행 표시가 다른 줄로 새지 않는다. 저장 · 취소로 닫히면 포커스는 이 줄의 「이름 바꾸기」 단추로 돌아온다.
 */
export function ProfileRow({
  profile,
  labels,
  config,
  rename,
  editing,
  onEdit,
  onClose,
  onDelete,
}: {
  profile: AuthorProfile
  labels: AuthorProfileLabels
  config: AuthorProfileConfig
  rename: RenameMutation
  editing: boolean
  /** 이 줄의 이름 바꾸기를 연다(목록이 다른 줄의 편집을 닫는다) */
  onEdit: () => void
  onClose: () => void
  onDelete: (profile: AuthorProfile) => void
}) {
  const [name, setName] = useState(profile.name ?? '')
  const [local, setLocal] = useState<string>()
  const rowRef = useRef<HTMLLIElement>(null)
  // 저장 · 취소로 닫힐 때만 포커스를 돌려받는다 — 다른 줄이 열려서 닫히는 줄이 포커스를 가로채지 않게
  const restoreFocus = useRef(false)
  const shown = profileDisplay(profile, labels.unnamed)
  const problem = editing ? profileFormProblem(rename.error, labels, config) : undefined
  // 다른 줄을 저장하는 동안에는 이 줄을 건드리지 않는다(진행 · 오류가 한 줄에 있게)
  const busyElsewhere = rename.isPending && !editing

  useEffect(() => {
    if (!editing && restoreFocus.current) {
      restoreFocus.current = false
      rowRef.current?.querySelector<HTMLElement>('[data-rename]')?.focus()
    }
  }, [editing])

  function close() {
    restoreFocus.current = true
    onClose()
  }

  function open() {
    rename.reset()
    setName(profile.name ?? '')
    setLocal(undefined)
    onEdit()
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    const found = nameProblem(name, labels, config)
    setLocal(found)
    if (found) return
    try {
      await rename.mutateAsync({ id: profile.id, name: name.trim() })
      close()
    } catch {
      // 서버의 답은 rename.error 로 폼이 말한다
    }
  }

  return (
    <li ref={rowRef} className={styles.row} data-profile-row="">
      <span className={styles.identity}>
        <span className={styles.name}>{profile.name ?? labels.unnamed}</span>
        {profile.tag && <span className={styles.tag}>{`#${profile.tag}`}</span>}
      </span>
      {!editing && (
        <span className={styles.actions}>
          <Button
            variant="secondary"
            size="sm"
            data-rename=""
            disabled={busyElsewhere}
            aria-label={labels.rename(shown)}
            onClick={open}
          >
            {labels.renameAction}
          </Button>
          <Button
            variant="danger"
            size="sm"
            disabled={busyElsewhere}
            aria-label={labels.remove(shown)}
            onClick={() => onDelete(profile)}
          >
            {labels.removeAction}
          </Button>
        </span>
      )}
      {editing && (
        <form className={styles.renameForm} onSubmit={submit} aria-label={labels.rename(shown)}>
          {problem?.where === 'form' && <Alert tone="danger">{problem.message}</Alert>}
          <Field
            label={labels.renameLabel(shown)}
            error={local ?? (problem?.where === 'name' ? problem.message : undefined)}
          >
            {(control) => (
              <Input
                {...control}
                autoComplete="off"
                autoFocus
                value={name}
                onChange={(event) => {
                  setName(event.target.value)
                  setLocal(undefined)
                  if (rename.error) rename.reset()
                }}
              />
            )}
          </Field>
          <div className={styles.formActions}>
            <Button type="submit" size="sm" loading={rename.isPending} loadingLabel="">
              {rename.isPending ? labels.saving : labels.save}
            </Button>
            <Button size="sm" variant="ghost" disabled={rename.isPending} onClick={close}>
              {labels.cancel}
            </Button>
          </div>
        </form>
      )}
    </li>
  )
}
