import { Alert, Button, ErrorReference, Field, Input } from '@skeleton/ui'
import { useState, type FormEvent } from 'react'
import { workspaceProblem } from './errors'
import { useCreateWorkspace } from './hooks'
import { defaultWorkspaceLabels, type WorkspaceLabels } from './labels'
import { slugFromName } from './slug'
import type { WorkspaceSummary } from './types'
import { validateWorkspaceForm } from './validation'
import type { WorkspaceApi } from './workspaceApi'
import styles from './WorkspaceForm.module.css'

export type CreateWorkspaceFormProps = {
  api: Pick<WorkspaceApi, 'create'>
  /** 만들어졌을 때 — 앱이 새 팀의 `/w/<slug>/…` 로 이동한다 */
  onCreated: (workspace: WorkspaceSummary) => void
  /** 있으면 「취소」가 생긴다(첫 팀을 만드는 화면에는 갈 곳이 없으니 생략) */
  onCancel?: () => void
  labels?: WorkspaceLabels
}

/**
 * 워크스페이스 만들기 — 이름 + 주소 이름. 주소 이름은 이름에서 제안하고(직접 고치면 그 값),
 * 제안할 게 없으면(영문이 아닌 이름) 비워 두어 서버가 정하게 한다
 */
export function CreateWorkspaceForm({
  api,
  onCreated,
  onCancel,
  labels = defaultWorkspaceLabels,
}: CreateWorkspaceFormProps) {
  const [name, setName] = useState('')
  const [typedSlug, setTypedSlug] = useState<string | null>(null)
  const [attempted, setAttempted] = useState(false)
  const create = useCreateWorkspace(api)
  const slug = typedSlug ?? slugFromName(name)
  const errors = attempted ? validateWorkspaceForm(labels, { name, slug }) : {}
  const problem = create.isError ? workspaceProblem(create.error) : null

  function submit(event: FormEvent) {
    event.preventDefault()
    setAttempted(true)
    if (Object.keys(validateWorkspaceForm(labels, { name, slug })).length > 0) return
    create.mutate({ name: name.trim(), slug: slug || undefined }, { onSuccess: onCreated })
  }

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <Field label={labels.form.nameLabel} error={errors.name} required>
        {(control) => (
          <Input
            {...control}
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoComplete="off"
          />
        )}
      </Field>
      <Field
        label={labels.form.slugLabel}
        hint={labels.form.slugHint}
        error={errors.slug ?? (problem === 'slugTaken' ? labels.form.slugTaken : undefined)}
      >
        {(control) => (
          <Input
            {...control}
            value={slug}
            onChange={(event) => setTypedSlug(event.target.value)}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
          />
        )}
      </Field>
      {create.isError && problem !== 'slugTaken' && (
        <Alert tone="danger">
          {labels.form.failed}
          <ErrorReference error={create.error} />
        </Alert>
      )}
      <div className={styles.actions}>
        <Button type="submit" loading={create.isPending} loadingLabel={labels.loading}>
          {labels.create.submit}
        </Button>
        {onCancel && (
          <Button variant="secondary" onClick={onCancel}>
            {labels.cancel}
          </Button>
        )}
      </div>
    </form>
  )
}
