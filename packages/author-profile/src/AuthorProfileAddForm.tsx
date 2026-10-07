import { newIdempotencyKey } from '@skeleton/api-client'
import { Alert, Button, Field, Input } from '@skeleton/ui'
import { useId, useRef, useState, type FormEvent } from 'react'
import type { AuthorProfileApi } from './authorProfileApi'
import { nameProblem, profileFormProblem, shouldReuseIdempotencyKey } from './errors'
import { useCreateAuthorProfile } from './hooks'
import type { AuthorProfileLabels } from './labels'
import type { AuthorProfileConfig } from './types'
import styles from './AuthorProfileManager.module.css'

/**
 * 프로필 추가 폼 — 이름 칸 + 단추. 서버 답은 제자리에서 말한다. 상한이면 칸 · 단추가 꺼지고 이유 문장이 둘의 `aria-describedby` 다.
 * 추가가 **네트워크 실패**(`status 0` — 요청이 닿았는지 모른다)로 끝난 뒤 같은 이름을 다시 보내면 같은 `Idempotency-Key` 를 쓴다(프로필이 둘 생기지 않게).
 * 성공하거나 서버가 답한 실패(4xx · 5xx)이거나 이름이 바뀌면 다음 제출은 새 키다.
 */
export function AuthorProfileAddForm({
  api,
  labels,
  config,
  atLimit,
  onAdd,
}: {
  api: AuthorProfileApi
  labels: AuthorProfileLabels
  config: AuthorProfileConfig
  atLimit: boolean
  /** 제출이 검증을 통과해 서버로 나갈 때 */
  onAdd?: () => void
}) {
  const create = useCreateAuthorProfile(api)
  const [name, setName] = useState('')
  const [local, setLocal] = useState<string>()
  const limitId = useId()
  const retry = useRef<{ name: string; key: string }>(undefined)
  // 만들기의 429 는 시간을 약속하지 않는다(계정 전체 한도와 창을 나눠 쓸 수 있다) — 이름 바꾸기만 정확한 시간
  const problem = profileFormProblem(create.error, labels, config, { showWait: false })

  async function add(event: FormEvent) {
    event.preventDefault()
    const found = nameProblem(name, labels, config)
    setLocal(found)
    if (found) return
    const trimmed = name.trim()
    const key = retry.current?.name === trimmed ? retry.current.key : newIdempotencyKey()
    retry.current = { name: trimmed, key }
    onAdd?.()
    try {
      await create.mutateAsync({ name: trimmed, idempotencyKey: key })
      retry.current = undefined
      setName('')
    } catch (error) {
      if (!shouldReuseIdempotencyKey(error)) retry.current = undefined
    }
  }

  return (
    <form className={styles.form} onSubmit={add} aria-label={labels.add}>
      {atLimit && (
        <p id={limitId} className={styles.note}>
          {labels.limitReached(config.maxPerAccount)}
        </p>
      )}
      {problem?.where === 'form' && !atLimit && <Alert tone="danger">{problem.message}</Alert>}
      <Field
        label={labels.nameLabel}
        hint={labels.nameHint(config.nameMaxLength)}
        error={local ?? (problem?.where === 'name' ? problem.message : undefined)}
      >
        {(control) => (
          <Input
            {...control}
            data-new-name=""
            aria-describedby={
              [control['aria-describedby'], atLimit ? limitId : undefined]
                .filter(Boolean)
                .join(' ') || undefined
            }
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
          aria-describedby={atLimit ? limitId : undefined}
          loading={create.isPending}
          loadingLabel=""
        >
          {create.isPending ? labels.adding : labels.add}
        </Button>
      </div>
    </form>
  )
}
