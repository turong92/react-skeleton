import { Button, RowMenu } from '@skeleton/ui'
import { useEffect, useState } from 'react'
import type { AuthorProfileApi } from './authorProfileApi'
import type { AuthorMemory } from './authorMemory'
import { useAuthorProfiles } from './hooks'
import { resolveInitialAuthor, switchNotice } from './initialAuthor'
import { mergeLabels, type AuthorProfileLabels } from './labels'
import { profileDisplay, type AuthorProfile } from './types'
import styles from './AuthorPicker.module.css'

/** 게시판 `authorPicker` 렌더 함수가 받는 것(`@skeleton/board` 의 `AuthorPickerArgs` 와 같은 모양 — 이 패키지는 보드를 import 하지 않는다) */
export type AuthorPickerSlotProps = {
  /** 지금 고른 프로필 id — 없으면 undefined(골라야 보낼 수 있다) */
  value: string | undefined
  onChange: (authorId: string | undefined) => void
  /** 이 스레드에서 내가 마지막으로 쓴 프로필 id */
  threadAuthorId: string | undefined
  /** 칸 오류 문장이 보이는 중인가 */
  invalid: boolean
  disabled: boolean
}

export type AuthorPickerViewProps = AuthorPickerSlotProps & {
  /** 지금 살아 있는 내 프로필 */
  profiles: readonly AuthorProfile[]
  /** 이 선택기가 쓰는 게시판 — 기기 기억의 칸 */
  boardCode: string
  /** 있으면 처음 값(②)을 읽고 사람이 고른 것을 쓴다 */
  memory?: AuthorMemory
  /** 프로필이 하나도 없을 때 「프로필 만들기」 단추가 부르는 앱의 진입(관리 화면으로 가기 · 만들기 창 열기) */
  onCreateProfile?: () => void
  labels?: Partial<AuthorProfileLabels>
}

type Pending = { next: AuthorProfile; thread: AuthorProfile }

/**
 * 작성자 선택기(데이터를 이미 가진 모습) — 접힌 상태는 **지금 고른 `이름#꼬리표` 하나**만 늘 보이고, 목록은 눌러야 열린다(메뉴 단추: ↑↓ · Home · End · Esc).
 * 처음 값은 ① 이 스레드에서 쓴 프로필 ② 이 기기가 기억하는 이 게시판의 프로필 ③ 비어 있음. 이 스레드에서 쓴 프로필과 **다른 것으로 바꿀 때만** 한 줄 확인이 나온다(늘 떠 있는 경고는 없다).
 * 계정 id 는 어디에도 그리지 않는다(프로필 id 도 글자로는 그리지 않는다).
 */
export function AuthorPickerView({
  profiles,
  boardCode,
  memory,
  onCreateProfile,
  labels: given,
  value,
  onChange,
  threadAuthorId,
  invalid,
  disabled,
}: AuthorPickerViewProps) {
  const labels = mergeLabels(given)
  const [pending, setPending] = useState<Pending>()
  const current = profiles.find((profile) => profile.id === value)

  // 처음 값 — 비어 있으면 ①② 로 채우고, 값이 더는 내 프로필이 아니면(다른 탭에서 지움) 비운다
  useEffect(() => {
    if (value !== undefined && !current) {
      onChange(undefined)
      return
    }
    if (value === undefined) {
      const initial = resolveInitialAuthor({
        profiles,
        threadAuthorId,
        remembered: memory?.get(boardCode),
      })
      if (initial !== undefined) onChange(initial)
    }
  }, [value, current, profiles, threadAuthorId, memory, boardCode, onChange])

  function apply(profile: AuthorProfile) {
    setPending(undefined)
    onChange(profile.id)
    memory?.set(boardCode, profile.id)
  }

  function choose(profile: AuthorProfile) {
    if (profile.id === value) return setPending(undefined)
    const thread = switchNotice({ profiles, threadAuthorId, nextId: profile.id })
    if (thread) setPending({ next: profile, thread })
    else apply(profile)
  }

  if (profiles.length === 0) {
    return (
      <div className={styles.root} data-invalid={invalid ? 'true' : undefined}>
        {onCreateProfile ? (
          <Button variant="secondary" disabled={disabled} onClick={onCreateProfile}>
            {labels.createProfile}
          </Button>
        ) : (
          <span>{labels.noProfiles}</span>
        )}
      </div>
    )
  }

  const shown = current ? profileDisplay(current) : undefined
  return (
    <div className={styles.root} data-invalid={invalid ? 'true' : undefined}>
      <RowMenu
        label={labels.triggerLabel(shown)}
        align="start"
        disabled={disabled}
        trigger={
          <span className={styles.current}>
            {current ? (
              <>
                <span className={styles.name}>{current.name}</span>
                <span className={styles.tag}>{`#${current.tag}`}</span>
              </>
            ) : (
              <span>{labels.choose}</span>
            )}
            <span className={styles.chevron} aria-hidden="true">
              ▾
            </span>
          </span>
        }
        items={profiles.map((profile) => ({
          key: profile.id,
          label: profileDisplay(profile),
          checked: profile.id === value,
          onSelect: () => choose(profile),
        }))}
      />
      {pending && (
        <div
          className={styles.notice}
          role="group"
          aria-label={labels.switchNotice(profileDisplay(pending.thread))}
        >
          <p role="status">{labels.switchNotice(profileDisplay(pending.thread))}</p>
          <Button size="sm" variant="primary" onClick={() => apply(pending.next)}>
            {labels.switchConfirm(profileDisplay(pending.next))}
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setPending(undefined)}>
            {labels.switchKeep(profileDisplay(pending.thread))}
          </Button>
        </div>
      )}
    </div>
  )
}

export type AuthorPickerProps = AuthorPickerSlotProps &
  Omit<AuthorPickerViewProps, 'profiles' | keyof AuthorPickerSlotProps> & {
    api: AuthorProfileApi
  }

/**
 * 게시판의 `authorPicker` 에 꽂는 선택기 — 목록은 `useAuthorProfiles(api)` 로 가져온다.
 * `authorPicker={(args) => <AuthorPicker {...args} api={api} boardCode={code} memory={memory} />}`
 */
export function AuthorPicker({ api, ...rest }: AuthorPickerProps) {
  const labels = mergeLabels(rest.labels)
  const list = useAuthorProfiles(api)
  if (list.data) return <AuthorPickerView {...rest} profiles={list.data} />
  if (list.isError)
    return (
      <Button variant="secondary" disabled={rest.disabled} onClick={() => void list.refetch()}>
        {labels.loadFailed}
      </Button>
    )
  return (
    <Button variant="secondary" loading loadingLabel={labels.loading}>
      {labels.loading}
    </Button>
  )
}
