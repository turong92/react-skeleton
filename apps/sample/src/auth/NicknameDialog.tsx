import { ErrorCodes, isErrorCode } from '@skeleton/api-client'
import { authErrorMessage, displayNameProblem, mergeLabels } from '@skeleton/auth'
import { Button, Dialog, Field, Input } from '@skeleton/ui'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useId, useState, type FormEvent } from 'react'
import { useT } from '../i18n'
import styles from './NicknameDialog.module.css'
import { accountApi } from './session'
import { useAuthLabels } from './useAuthLabels'
import { myProfileKey } from './useMyProfile'

/** 닉네임을 그 자리에서 입력 · 저장하는 작은 대화상자 — `PATCH /account/me`(`displayName`) 한 번. 겹치는 닉네임(중복 금지 서버)은 칸 아래에 */
export function NicknameDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useT()
  const labels = mergeLabels(useAuthLabels())
  const client = useQueryClient()
  const formId = useId()
  const [value, setValue] = useState('')
  const [attempted, setAttempted] = useState(false)
  const [serverError, setServerError] = useState<string>()
  /** 닫을 때마다 입력 · 안내를 비운다 — 다시 열면 깨끗한 칸 */
  const close = () => {
    setValue('')
    setAttempted(false)
    setServerError(undefined)
    onClose()
  }
  const save = useMutation({
    mutationFn: (displayName: string) => accountApi.updateProfile({ displayName }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: myProfileKey })
      close()
    },
    onError: (error) => {
      // 그 밖의 실패는 앱의 전역 오류 토스트가 맡는다
      if (isErrorCode(error, ErrorCodes.ACCOUNT_DISPLAY_NAME_TAKEN))
        setServerError(authErrorMessage(error, labels).message)
    },
  })
  const problem = displayNameProblem(value, 'required', labels)

  function submit(event: FormEvent) {
    event.preventDefault()
    setAttempted(true)
    setServerError(undefined)
    if (problem) return
    save.mutate(value.trim())
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      title={t('nickname.dialogTitle')}
      closeLabel={t('common.close')}
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            {t('nickname.later')}
          </Button>
          <Button
            type="submit"
            form={formId}
            loading={save.isPending}
            loadingLabel={t('nickname.saving')}
          >
            {t('nickname.save')}
          </Button>
        </>
      }
    >
      <form id={formId} className={styles.form} onSubmit={submit} noValidate>
        <p>{t('nickname.dialogBody')}</p>
        <Field
          label={labels.displayName}
          hint={labels.displayNameHint}
          required
          error={serverError ?? (attempted ? problem : undefined)}
        >
          {(control) => (
            <Input
              {...control}
              autoFocus
              autoComplete="nickname"
              value={value}
              onChange={(event) => {
                setValue(event.target.value)
                setServerError(undefined)
              }}
            />
          )}
        </Field>
      </form>
    </Dialog>
  )
}
