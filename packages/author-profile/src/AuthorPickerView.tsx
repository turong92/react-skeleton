import { Button, RowMenu } from '@skeleton/ui'
import { useEffect, useId, useRef, useState } from 'react'
import type { AuthorPickerViewProps } from './authorPickerTypes'
import { AuthorPickerNotice } from './AuthorPickerNotice'
import { switchNotice } from './initialAuthor'
import { mergeLabels } from './labels'
import { ProfileIdentity } from './ProfileIdentity'
import { profileDisplay, type AuthorProfile } from './types'
import { useAutoAuthor } from './useAutoAuthor'
import styles from './AuthorPicker.module.css'

export type { AuthorPickerSlotProps, AuthorPickerViewProps } from './authorPickerTypes'

/** 한 줄 확인이 묻는 것 — `premise` 는 물은 때의 전제(값 · 이 스레드의 프로필 · 잠금). 전제가 바뀌면 낡은 질문이라 버린다 */
type Question = { next: AuthorProfile; thread: AuthorProfile; premise: string }

/**
 * 작성자 선택기(데이터를 이미 가진 모습) — 접힌 상태는 **지금 고른 `이름#꼬리표` 하나**만 늘 보이고, 목록은 눌러야 열린다(메뉴 단추: ↑↓ · Home · End · Esc).
 * 처음 값(`useAutoAuthor`) · 한 줄 확인(`AuthorPickerNotice`) · 잠금 규칙은 README 「선택기가 지키는 것」. 계정 id 는 어디에도 그리지 않는다(프로필 id 도 글자로는 그리지 않는다).
 */
export function AuthorPickerView({
  profiles,
  boardCode,
  memory,
  onCreateProfile,
  createOpensDialog = false,
  labels: given,
  value,
  onChange,
  threadAuthorId,
  threadLoading,
  invalid,
  disabled,
  onUnsettledChange,
  'aria-describedby': outerDescribedBy,
}: AuthorPickerViewProps) {
  const labels = mergeLabels(given)
  const [question, setQuestion] = useState<Question>()
  const rootRef = useRef<HTMLDivElement>(null)
  const noticeId = useId()
  const current = profiles.find((profile) => profile.id === value)
  const show = (profile: Pick<AuthorProfile, 'name' | 'tag'>) =>
    profileDisplay(profile, labels.unnamed)
  const parts = (profile: Pick<AuthorProfile, 'name' | 'tag'>) => ({
    name: profile.name ?? labels.unnamed,
    tag: profile.tag,
  })
  const locked = disabled || threadLoading
  const { chosen } = useAutoAuthor({
    profiles,
    value,
    onChange,
    threadAuthorId,
    threadLoading,
    memory,
    boardCode,
  })

  // 한 줄 확인은 그것이 물은 전제(값 · 이 스레드의 프로필 · 잠금)가 바뀌면 낡은 질문이다 — 닫는다
  const premise = `${value ?? ''}|${threadAuthorId ?? ''}|${locked}`
  const pending = question?.premise === premise ? question : undefined
  if (question && !pending) setQuestion(undefined) // 낡은 질문은 보이지 않는 데 그치지 않고 비운다(전제가 되돌아와도 되살아나지 않게)

  // 확인이 떠 있는 동안 선택기 단추는 그 문장도 설명으로 가진다
  const describedBy =
    [outerDescribedBy, pending ? noticeId : undefined].filter(Boolean).join(' ') || undefined

  // 폼에 「답이 필요한 질문이 떠 있다」를 알린다(제출을 막게) — 선택기가 사라질 때는 푼다
  const unsettled = pending !== undefined
  const latestUnsettled = useRef(onUnsettledChange)
  useEffect(() => {
    latestUnsettled.current = onUnsettledChange
  })
  useEffect(() => {
    onUnsettledChange(unsettled)
  }, [unsettled, onUnsettledChange])
  useEffect(() => () => latestUnsettled.current(false), [])

  // 다른 곳으로 포커스가 가거나 거기를 누르면 닫는다(고르지도 유지하지도 않고 떠난 것). **같은 폼 안**(제출 단추 포함)은 떠난 것이 아니다 —
  // 제출은 폼이 「확인이 떠 있다」며 막고 포커스를 확인 줄로 보낸다
  useEffect(() => {
    if (!pending) return
    const outside = (event: Event) => {
      const scope = rootRef.current?.closest('form') ?? rootRef.current
      if (!scope?.contains(event.target as Node)) setQuestion(undefined)
    }
    document.addEventListener('focusin', outside)
    document.addEventListener('pointerdown', outside)
    return () => {
      document.removeEventListener('focusin', outside)
      document.removeEventListener('pointerdown', outside)
    }
  }, [pending])

  const focusTrigger = () =>
    rootRef.current?.querySelector<HTMLElement>('button[aria-haspopup]')?.focus()

  function apply(profile: AuthorProfile) {
    setQuestion(undefined)
    chosen() // 사람이 고른 값
    onChange(profile.id)
    memory?.set(boardCode, profile.id)
    focusTrigger() // 확인 줄이 사라지므로 포커스를 단추로 — body 로 떨어지지 않게
  }

  function choose(profile: AuthorProfile) {
    if (profile.id === value) {
      chosen() // 지금 값을 사람이 다시 골랐다 — 스레드가 덮지 않는다
      return setQuestion(undefined)
    }
    const thread = switchNotice({ profiles, threadAuthorId, nextId: profile.id })
    if (thread) setQuestion({ next: profile, thread, premise })
    else apply(profile)
  }

  if (profiles.length === 0) {
    return (
      <div ref={rootRef} className={styles.root} data-invalid={invalid ? 'true' : undefined}>
        {onCreateProfile ? (
          <Button
            variant="secondary"
            disabled={disabled}
            aria-describedby={outerDescribedBy}
            aria-haspopup={createOpensDialog ? 'dialog' : undefined}
            onClick={onCreateProfile}
          >
            {labels.createProfile}
          </Button>
        ) : (
          <span>{labels.noProfiles}</span>
        )}
      </div>
    )
  }

  // 고른 값이 없고 댓글을 받는 중이면 단추가 그것을 말한다(보이는 글자 = 낭독 이름)
  const waiting = threadLoading && !current
  return (
    <div
      ref={rootRef}
      className={styles.root}
      data-invalid={invalid ? 'true' : undefined}
      onKeyDown={(event) => {
        // 열린 메뉴의 Esc 는 메뉴가 먼저 쓴다(defaultPrevented) — 그 밖의 Esc 는 떠 있는 확인을 접는다
        if (event.key !== 'Escape' || event.defaultPrevented || !pending) return
        setQuestion(undefined)
        focusTrigger()
      }}
    >
      <RowMenu
        label={waiting ? labels.threadLoading : labels.triggerLabel(current && show(current))}
        align="start"
        disabled={locked}
        describedBy={describedBy}
        trigger={
          <span className={styles.current}>
            {current ? (
              <ProfileIdentity {...parts(current)} />
            ) : (
              <span>{waiting ? labels.threadLoading : labels.choose}</span>
            )}
            <span className={styles.chevron} aria-hidden="true">
              ▾
            </span>
          </span>
        }
        items={profiles.map((profile) => ({
          key: profile.id,
          label: show(profile),
          content: <ProfileIdentity {...parts(profile)} />,
          checked: profile.id === value,
          onSelect: () => choose(profile),
        }))}
      />
      {pending && (
        <AuthorPickerNotice
          id={noticeId}
          describedBy={outerDescribedBy}
          labels={labels}
          thread={show(pending.thread)}
          next={show(pending.next)}
          hasCurrent={current !== undefined}
          onUse={() => apply(pending.next)}
          onKeep={() => {
            chosen() // 지금 값을 유지하기로 했다 — 사람의 결정
            setQuestion(undefined)
            focusTrigger()
          }}
        />
      )}
    </div>
  )
}
