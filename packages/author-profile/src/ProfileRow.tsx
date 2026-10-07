import { Alert, Button, Field, Input } from '@skeleton/ui'
import { useState, type FormEvent } from 'react'
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

/** 목록의 한 줄 — 이름#꼬리표 · 이름 바꾸기(제자리 폼) · 삭제(요청만, 확인 창은 목록이 연다) */
export function ProfileRow({
  profile,
  labels,
  config,
  rename,
  onDelete,
}: {
  profile: AuthorProfile
  labels: AuthorProfileLabels
  config: AuthorProfileConfig
  rename: RenameMutation
  onDelete: (profile: AuthorProfile) => void
}) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(profile.name)
  const [local, setLocal] = useState<string>()
  const shown = profileDisplay(profile)
  const problem = editing ? profileFormProblem(rename.error, labels, config) : undefined

  function open() {
    rename.reset()
    setName(profile.name)
    setLocal(undefined)
    setEditing(true)
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    const found = nameProblem(name, labels, config)
    setLocal(found)
    if (found) return
    try {
      await rename.mutateAsync({ id: profile.id, name: name.trim() })
      setEditing(false)
    } catch {
      // 서버의 답은 rename.error 로 폼이 말한다
    }
  }

  return (
    <li className={styles.row}>
      <span className={styles.identity}>
        <span className={styles.name}>{profile.name}</span>
        <span className={styles.tag}>{`#${profile.tag}`}</span>
      </span>
      {!editing && (
        <span className={styles.actions}>
          <Button variant="secondary" size="sm" aria-label={labels.rename(shown)} onClick={open}>
            {labels.renameAction}
          </Button>
          <Button
            variant="danger"
            size="sm"
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
            <Button type="submit" size="sm" loading={rename.isPending} loadingLabel={labels.saving}>
              {labels.save}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              {labels.cancel}
            </Button>
          </div>
        </form>
      )}
    </li>
  )
}
