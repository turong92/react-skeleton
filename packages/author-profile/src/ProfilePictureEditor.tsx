import { ApiRequestError } from '@skeleton/api-client'
import { Alert, Button } from '@skeleton/ui'
import { useState } from 'react'
import type { AuthorProfileLabels } from './labels'
import type { AuthorProfile, ProfilePicturePicker } from './types'
import styles from './AuthorProfileManager.module.css'

type AvatarMutation = {
  mutateAsync: (vars: { id: string; avatarKey: string | null }) => Promise<unknown>
  isPending: boolean
  error: unknown
  /** 마지막으로 보낸 요청 - 오류 · 진행이 다른 줄로 새지 않게 줄 id 와 견준다 */
  variables?: { id: string; avatarKey: string | null }
  reset: () => void
}

/**
 * 한 줄의 사진 고르기 - 앱이 꽂은 `picker`(보통 `ImageUploadField max={1}`)를 펼치고, 올리면 · 지우면 바로 저장한다(저장 단추 없음).
 * 서버가 사진 기능을 껐으면(`profile.avatarKey` 키 없음) 아무것도 그리지 않는다. 서버가 사진을 거절하면(400: 내 업로드가 아님 · 계정 id 가 든 키 · 계정/다른 닉네임이 쓰는 파일 · 이미지가 아님)
 * 줄 안에서 `labels.pictureRejected` 로 말한다. 저장하는 동안에는 고르기가 잠기고, 이름 바꾸기를 열어도 이 부품은 언마운트되지 않는다(올리던 사진이 취소되지 않게 줄이 계속 달아 둔다).
 */
export function ProfilePictureEditor({
  profile,
  labels,
  picker,
  avatar,
  shown,
}: {
  profile: AuthorProfile
  labels: AuthorProfileLabels
  picker: ProfilePicturePicker
  avatar: AvatarMutation
  shown: string
}) {
  const [open, setOpen] = useState(false)
  if (profile.avatarKey === undefined) return null
  const mine = avatar.variables?.id === profile.id
  const saving = avatar.isPending && mine
  const rejected =
    mine && avatar.error instanceof ApiRequestError && avatar.error.apiError.status === 400
  const failed = mine && avatar.error !== null && avatar.error !== undefined && !rejected
  const change = (key: string | null) => {
    avatar.reset()
    void avatar.mutateAsync({ id: profile.id, avatarKey: key }).catch(() => undefined) // 오류는 avatar.error 로 말한다
  }
  return (
    <span className={styles.pictureSlot}>
      <Button
        variant="secondary"
        size="sm"
        aria-expanded={open}
        aria-label={labels.picture(shown)}
        onClick={() => {
          if (mine) avatar.reset()
          setOpen(!open)
        }}
      >
        {labels.pictureAction}
      </Button>
      {/* 닫아도 마운트를 유지한다 - 올리는 중에 접거나 이름 바꾸기를 열어도 업로드가 취소되지 않는다 */}
      <div
        className={styles.picturePanel}
        role="group"
        aria-label={labels.pictureLabel(shown)}
        hidden={!open}
      >
        {rejected && <Alert tone="danger">{labels.pictureRejected}</Alert>}
        {failed && <Alert tone="danger">{labels.failed}</Alert>}
        {profile.avatar?.pending && <Alert tone="info">{labels.picturePending}</Alert>}
        <fieldset className={styles.pictureLock} disabled={saving}>
          {picker({ value: profile.avatarKey, onChange: change })}
        </fieldset>
      </div>
    </span>
  )
}
