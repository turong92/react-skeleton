import { useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react'
import { Button } from '../Button/Button'
import styles from './CodeEntry.module.css'
import { backspaceAt, digitsOf, fillFrom, isComplete } from './codeEntryState'
import {
  expiryMillis,
  formatClock,
  stageOf,
  watchRemaining,
  type ExpiryInput,
} from './codeEntryTime'

/** 남은 시간 문구 — 번역은 앱의 몫 */
export type CodeTimeLabels = {
  /** 칸 옆에 늘 보이는 줄 — 예: `(clock) => \`남은 시간 ${clock}\`` */
  remaining: (clock: string) => string
  /** 60초 아래가 되는 순간 한 번 읽는다 */
  minuteLeft: string
  /** 10초 아래가 되는 순간 한 번 읽는다 */
  secondsLeft: (seconds: number) => string
  /** 끝났을 때(보이는 안내이자 한 번 읽는 알림) — 예: 「시간이 지났어요. 인증번호를 다시 받아 주세요」 */
  expired: string
}

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
    /** 쿨다운 동안 **버튼 글자** — 예: `(s) => \`다시 받기 (${s}초)\``. 읽어 주는 영역이 아니라 초마다 낭독되지 않는다 */
    labelWhileWaiting?: (seconds: number) => string
  }
  /** 만료된 뒤 「다시 받기」가 없을 때(더 다시 보낼 수 없다) 대신 보이는 「처음부터 다시」 — 만료되면 이 버튼으로 포커스가 간다 */
  restart?: { label: string; onRestart: () => void }
  /**
   * 코드가 만료되는 **절대 시각**(서버가 준 값이 가장 좋다). 있으면 칸 옆에 남은 시간 `mm:ss` 를 보이고, 끝나면 칸을 잠그고 안내하며
   * 「다시 받기」로 포커스를 옮긴다. 다시 받은 뒤에는 **새 `expiresAt`** 를 넘기면 처음부터 센다. 서버 렌더에는 시간을 그리지 않는다(하이드레이션 일치)
   */
  expiresAt?: ExpiryInput
  /** 시계(기본 `Date.now`) — 서버 시각으로 보정한 시계를 넘기면 기기 시계 오차가 없다 */
  now?: () => number
  timeLabels?: CodeTimeLabels
  /** `expiresAt` 이 서버 값인지, 문서화된 유효 시간으로 **클라이언트가 추정한 값**인지 — `data-expiry-source` 로 남는다 */
  expirySource?: 'server' | 'estimate'
  /** 시간이 다 됐다(한 번) */
  onExpire?: () => void
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
  restart,
  id,
  expiresAt,
  now = Date.now,
  timeLabels,
  expirySource,
  onExpire,
}: CodeEntryProps) {
  const [cells, setCells] = useState<string[]>(() => Array.from({ length }, () => ''))
  const refs = useRef<Array<HTMLInputElement | null>>([])
  const [seenError, setSeenError] = useState<string | undefined>(undefined)
  const errorId = `${id ?? 'code'}-error`
  const expiresMs = expiryMillis(expiresAt)
  const timed = expiresMs !== null && !!timeLabels
  // 남은 초 — 서버 렌더 · 하이드레이션 첫 렌더에는 null(시간에 따라 다른 마크업이 나오지 않는다). 마운트 뒤 시계로 채운다
  const [remaining, setRemaining] = useState<number | null>(null)
  const nowRef = useRef(now)
  const onExpireRef = useRef(onExpire)
  useEffect(() => {
    nowRef.current = now
    onExpireRef.current = onExpire
  })
  useEffect(() => {
    if (!timed || expiresMs === null) return
    return watchRemaining({
      expiresAtMs: expiresMs,
      now: () => nowRef.current(),
      onChange: setRemaining,
    })
  }, [timed, expiresMs])
  const stage = remaining === null ? 'normal' : stageOf(remaining)
  const expired = timed && stage === 'expired'
  const locked = busy || disabled || expired
  const resendBox = useRef<HTMLDivElement | null>(null)

  // 새 오류가 오면(= 방금 낸 번호가 틀렸다) 칸을 비우고 처음으로 — 다시 칠 수 있게. 렌더 중 상태 조정(이전 값 비교)이라 effect 가 필요 없다
  if (error !== seenError) {
    setSeenError(error)
    if (error) setCells(Array.from({ length }, () => ''))
  }

  // 틀린 번호의 오류가 오면 첫 칸으로 돌아온다(칸이 잠겨 있던 제출 중이었다면 풀린 뒤라 포커스가 닿는다)
  useEffect(() => {
    if (error) refs.current[0]?.focus()
  }, [error])

  // 새 만료 시각이 왔다(= 다시 받았다) — 지난 번호를 비우고 남은 시간을 새로 센다. 렌더 중 상태 조정
  const [seenExpiry, setSeenExpiry] = useState(expiresMs)
  if (expiresMs !== seenExpiry) {
    setSeenExpiry(expiresMs)
    setRemaining(null)
    setCells(Array.from({ length }, () => ''))
  }

  // 끝났다: 한 번 알리고 「다시 받기」로 포커스(눌릴 수 있을 때만 — 쿨다운 중이면 버튼이 꺼져 있다). 다시 받아 풀리면 첫 칸으로
  const wasExpired = useRef(false)
  useEffect(() => {
    if (expired && !wasExpired.current) {
      resendBox.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus()
      onExpireRef.current?.()
    } else if (!expired && wasExpired.current) refs.current[0]?.focus()
    wasExpired.current = expired
  }, [expired])

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
  const announcement =
    !timed || remaining === null
      ? ''
      : stage === 'minute'
        ? (timeLabels?.minuteLeft ?? '')
        : stage === 'ten'
          ? (timeLabels?.secondsLeft(10) ?? '')
          : ''
  return (
    <div className={styles.root} data-expiry-source={timed ? expirySource : undefined}>
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
      {timed && (
        <>
          {/* 시간은 문턱(60초 · 10초 · 끝)에서만 읽는다 — 아래 줄은 읽어 주는 영역이 아니라 초마다 낭독되지 않는다 */}
          <p role="status" className={styles.srOnly}>
            {announcement}
          </p>
          {expired ? (
            <p role="alert" className={styles.timeUp}>
              {timeLabels.expired}
            </p>
          ) : (
            remaining !== null && (
              <p className={styles.time} data-stage={stage}>
                {timeLabels.remaining(formatClock(remaining))}
              </p>
            )
          )}
        </>
      )}
      {error && (
        <p id={errorId} role="alert" className={styles.error}>
          {error}
        </p>
      )}
      {!resend && restart && expired && (
        <div className={styles.resend} ref={resendBox}>
          <Button variant="secondary" size="sm" onClick={restart.onRestart}>
            {restart.label}
          </Button>
        </div>
      )}
      {resend && (
        <div className={styles.resend} ref={resendBox}>
          <Button
            variant="ghost"
            size="sm"
            disabled={busy || disabled || waiting}
            onClick={resend.onResend}
          >
            {waiting && resend.labelWhileWaiting
              ? resend.labelWhileWaiting(resend.secondsLeft ?? 0)
              : resend.label}
          </Button>
          {waiting && resend.waitLabel && (
            <span className={styles.wait}>{resend.waitLabel(resend.secondsLeft ?? 0)}</span>
          )}
        </div>
      )}
    </div>
  )
}
