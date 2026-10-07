import { Button, RowMenu } from '@skeleton/ui'
import { useEffect, useRef, useState } from 'react'
import type { AuthorMemory } from './authorMemory'
import { resolveInitialAuthor, switchNotice } from './initialAuthor'
import { mergeLabels, type AuthorProfileLabels } from './labels'
import { profileDisplay, type AuthorProfile } from './types'
import { AuthorPickerNotice } from './AuthorPickerNotice'
import styles from './AuthorPicker.module.css'

/** 게시판 `authorPicker` 렌더 함수가 받는 것(`@skeleton/board` 의 `AuthorPickerArgs` 와 같은 모양 — 이 패키지는 보드를 import 하지 않는다) */
export type AuthorPickerSlotProps = {
  /** 지금 고른 프로필 id — 없으면 undefined(골라야 보낼 수 있다) */
  value: string | undefined
  onChange: (authorId: string | undefined) => void
  /** 이 스레드에서 내가 마지막으로 쓴 프로필 id */
  threadAuthorId: string | undefined
  /** 댓글을 아직 받는 중 — true 인 동안은 처음 값을 확정하지 않는다(기기 기억으로도 넘어가지 않는다) */
  threadLoading: boolean
  /** 칸 오류 문장이 보이는 중인가 */
  invalid: boolean
  disabled: boolean
  /** 칸 오류 문장의 id — 선택기 단추에 `aria-describedby` 로 잇는다 */
  'aria-describedby'?: string
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
  /** 「프로필 만들기」가 창(대화상자)을 여는가 — 기본 true(`useProfileDialog`). 화면 이동이면 false 로 줘서 낭독기에 창이 열린다고 말하지 않게 한다 */
  createOpensDialog?: boolean
  labels?: Partial<AuthorProfileLabels>
}

/** 한 줄 확인이 묻는 것 — `premise` 는 물은 때의 전제(값 · 이 스레드의 프로필 · 잠금). 전제가 바뀌면 낡은 질문이라 버린다 */
type Question = { next: AuthorProfile; thread: AuthorProfile; premise: string }

/**
 * 작성자 선택기(데이터를 이미 가진 모습) — 접힌 상태는 **지금 고른 `이름#꼬리표` 하나**만 늘 보이고, 목록은 눌러야 열린다(메뉴 단추: ↑↓ · Home · End · Esc).
 * 처음 값 · 한 줄 확인(`AuthorPickerNotice`) · 잠금 규칙은 README 「선택기가 지키는 것」. 계정 id 는 어디에도 그리지 않는다(프로필 id 도 글자로는 그리지 않는다).
 */
export function AuthorPickerView({
  profiles,
  boardCode,
  memory,
  onCreateProfile,
  createOpensDialog = true,
  labels: given,
  value,
  onChange,
  threadAuthorId,
  threadLoading,
  invalid,
  disabled,
  'aria-describedby': describedBy,
}: AuthorPickerViewProps) {
  const labels = mergeLabels(given)
  const [question, setQuestion] = useState<Question>()
  const rootRef = useRef<HTMLDivElement>(null)
  const current = profiles.find((profile) => profile.id === value)
  const show = (profile: Pick<AuthorProfile, 'name' | 'tag'>) =>
    profileDisplay(profile, labels.unnamed)
  const locked = disabled || threadLoading

  // 한 줄 확인은 그것이 물은 전제(값 · 이 스레드의 프로필 · 잠금)가 바뀌면 낡은 질문이다 — 닫는다
  const premise = `${value ?? ''}|${threadAuthorId ?? ''}|${locked}`
  const pending = question?.premise === premise ? question : undefined
  if (question && !pending) setQuestion(undefined) // 낡은 질문은 보이지 않는 데 그치지 않고 비운다(전제가 되돌아와도 되살아나지 않게)

  // 바깥으로 포커스가 가거나 바깥을 누르면 닫는다(고르지도 유지하지도 않고 떠난 것)
  useEffect(() => {
    if (!pending) return
    const outside = (event: Event) => {
      if (!rootRef.current?.contains(event.target as Node)) setQuestion(undefined)
    }
    document.addEventListener('focusin', outside)
    document.addEventListener('pointerdown', outside)
    return () => {
      document.removeEventListener('focusin', outside)
      document.removeEventListener('pointerdown', outside)
    }
  }, [pending])

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
        threadLoading,
      })
      if (initial !== undefined) onChange(initial)
    }
  }, [value, current, profiles, threadAuthorId, threadLoading, memory, boardCode, onChange])

  const focusTrigger = () =>
    rootRef.current?.querySelector<HTMLElement>('button[aria-haspopup]')?.focus()

  function apply(profile: AuthorProfile) {
    setQuestion(undefined)
    onChange(profile.id)
    memory?.set(boardCode, profile.id)
    focusTrigger() // 확인 줄이 사라지므로 포커스를 단추로 — body 로 떨어지지 않게
  }

  function choose(profile: AuthorProfile) {
    if (profile.id === value) return setQuestion(undefined)
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
            aria-describedby={describedBy}
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

  const shown = current ? show(current) : undefined
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
        label={waiting ? labels.threadLoading : labels.triggerLabel(shown)}
        align="start"
        disabled={locked}
        describedBy={describedBy}
        trigger={
          <span className={styles.current}>
            {current ? (
              <>
                <span className={styles.name}>{current.name ?? labels.unnamed}</span>
                {current.tag && <span className={styles.tag}>{`#${current.tag}`}</span>}
              </>
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
          checked: profile.id === value,
          onSelect: () => choose(profile),
        }))}
      />
      {pending && (
        <AuthorPickerNotice
          labels={labels}
          thread={show(pending.thread)}
          next={show(pending.next)}
          current={current ? show(current) : undefined}
          onUse={() => apply(pending.next)}
          onKeep={() => {
            setQuestion(undefined)
            focusTrigger()
          }}
        />
      )}
    </div>
  )
}
