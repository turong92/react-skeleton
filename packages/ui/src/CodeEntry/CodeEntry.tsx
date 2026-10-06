import { useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react'
import { Button } from '../Button/Button'
import styles from './CodeEntry.module.css'
import { backspaceAt, digitsOf, fillFrom, isComplete } from './codeEntryState'

export type CodeEntryProps = {
  /** 그룹 이름(스크린 리더가 「인증번호」로 읽는다) */
  label: string
  /** 칸 하나의 이름 — 예: `(i, n) => \`${n}자리 중 ${i}번째\`` */
  digitLabel: (position: number, total: number) => string
  /** 칸 수(기본 6) */
  length?: number
  /** 모두 채워지면 한 번 부른다(자동 제출). 실패하면 칸이 비워지고 첫 칸으로 돌아온다 */
  onComplete: (code: string) => void
  /** 바뀔 때마다(선택) */
  onChange?: (code: string) => void
  /** 오류 문구 — 있으면 칸이 오류 표시가 되고 `role="alert"` 로 읽힌다. 새 문구가 오면 칸을 비우고 첫 칸에 포커스 */
  error?: string
  /** 제출 중 — 입력을 잠근다 */
  busy?: boolean
  disabled?: boolean
  /** 다시 보내기. `secondsLeft > 0` 이면 눌리지 않고 `waitLabel` 이 남은 시간을 말한다 */
  resend?: {
    label: string
    onResend: () => void
    secondsLeft?: number
    waitLabel?: (seconds: number) => string
  }
  /** 첫 칸에 달 `id`(바깥 `Field` 의 라벨 연결용은 필요 없다 — 그룹 라벨이 있다) */
  id?: string
}

/**
 * 인증번호 입력 — 숫자 칸 여러 개(기본 6). 모바일에서는 숫자 키패드(`inputMode="numeric"`), 첫 칸에 `autocomplete="one-time-code"` 라
 * 메일 · 문자의 코드 제안을 받고, 어느 칸에든 붙여넣으면 그 칸부터 채운다. 칸에서 Backspace 는 앞 칸으로 넘어가고, 방향키로 오간다.
 * 다 채워지면 `onComplete` — 버튼 없이 제출된다. 라벨 · 문구는 모두 prop(번역은 앱의 몫).
 */
export function CodeEntry({
  label,
  digitLabel,
  length = 6,
  onComplete,
  onChange,
  error,
  busy = false,
  disabled = false,
  resend,
  id,
}: CodeEntryProps) {
  const [cells, setCells] = useState<string[]>(() => Array.from({ length }, () => ''))
  const refs = useRef<Array<HTMLInputElement | null>>([])
  const [seenError, setSeenError] = useState<string | undefined>(undefined)
  const errorId = `${id ?? 'code'}-error`
  const locked = busy || disabled

  // 새 오류가 오면(= 방금 낸 번호가 틀렸다) 칸을 비우고 처음으로 — 다시 칠 수 있게. 렌더 중 상태 조정(이전 값 비교)이라 effect 가 필요 없다
  if (error !== seenError) {
    setSeenError(error)
    if (error) setCells(Array.from({ length }, () => ''))
  }

  // 틀린 번호의 오류가 오면 첫 칸으로 돌아온다(칸이 잠겨 있던 제출 중이었다면 풀린 뒤라 포커스가 닿는다)
  useEffect(() => {
    if (error) refs.current[0]?.focus()
  }, [error])

  function focus(index: number) {
    const input = refs.current[index]
    input?.focus()
    input?.select()
  }

  function commit(next: string[], focusAt: number) {
    setCells(next)
    onChange?.(next.join(''))
    focus(focusAt)
    if (isComplete(next)) onComplete(next.join(''))
  }

  function type(index: number, text: string) {
    const { cells: next, focus: at } = fillFrom(cells, index, text)
    commit(next, at)
  }

  function onKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Backspace') {
      event.preventDefault()
      const { cells: next, focus: at } = backspaceAt(cells, index)
      setCells(next)
      onChange?.(next.join(''))
      focus(at)
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault()
      focus(Math.max(0, index - 1))
    } else if (event.key === 'ArrowRight') {
      event.preventDefault()
      focus(Math.min(length - 1, index + 1))
    }
  }

  function onPaste(index: number, event: ClipboardEvent<HTMLInputElement>) {
    event.preventDefault()
    // 붙여넣기는 칸 순서와 상관없이 처음부터 — 6자리를 통째로 붙이는 것이 흔하다
    const digits = digitsOf(event.clipboardData.getData('text'))
    type(digits.length >= length ? 0 : index, digits)
  }

  const waiting = (resend?.secondsLeft ?? 0) > 0
  return (
    <div className={styles.root}>
      <div
        role="group"
        aria-label={label}
        aria-describedby={error ? errorId : undefined}
        className={styles.cells}
      >
        {cells.map((cell, index) => (
          <input
            key={index}
            id={index === 0 ? id : undefined}
            ref={(element) => {
              refs.current[index] = element
            }}
            className={styles.cell}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete={index === 0 ? 'one-time-code' : 'off'}
            maxLength={length}
            value={cell}
            disabled={locked}
            aria-label={digitLabel(index + 1, length)}
            aria-invalid={error ? true : undefined}
            onChange={(event) => type(index, event.target.value)}
            onKeyDown={(event) => onKeyDown(index, event)}
            onPaste={(event) => onPaste(index, event)}
            onFocus={(event) => event.target.select()}
          />
        ))}
      </div>
      {error && (
        <p id={errorId} role="alert" className={styles.error}>
          {error}
        </p>
      )}
      {resend && (
        <div className={styles.resend}>
          <Button variant="ghost" size="sm" disabled={locked || waiting} onClick={resend.onResend}>
            {resend.label}
          </Button>
          {waiting && resend.waitLabel && (
            <span className={styles.wait} aria-live="polite">
              {resend.waitLabel(resend.secondsLeft ?? 0)}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
