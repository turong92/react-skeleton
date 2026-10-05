import { ApiRequestError } from '@skeleton/api-client'
import { useEffect, useId, useRef, useState } from 'react'
import styles from './ErrorReference.module.css'

export type ErrorReferenceProps = {
  /** 오류 값 — `ApiRequestError` 면 그 traceId 가 참조 번호다 */
  error?: unknown
  /** 참조 번호를 직접 줄 때(`showApiError` 가 돌려준 값 등). `error` 보다 우선한다 */
  reference?: string
  /** 번호 앞 이름(기본 `Reference`) */
  label?: string
  /** 복사 버튼 글자(기본 `Copy`) */
  copyLabel?: string
  /** 복사한 뒤 알리는 글자(기본 `Copied`) — 낭독 영역(`role="status"`)에도 들어간다 */
  copiedLabel?: string
  /** 복사 버튼 말풍선(`title`) */
  copyHint?: string
  className?: string
}

/** 문의 · 로그 추적에 쓰는 참조 번호(traceId). API 오류가 아니면 undefined */
export function errorReferenceOf(error: unknown): string | undefined {
  if (!(error instanceof ApiRequestError)) return undefined
  return error.apiError.traceId || error.traceId || undefined
}

const COPIED_VISIBLE_MS = 2_000

/**
 * 오류 화면 · 배너 아래에 붙이는 「참조 번호 …  [복사]」 — 서버 로그의 traceId 라 문의할 때 그 요청을 바로 찾는다.
 * 토스트는 사라지지만 이 줄은 화면에 남는다(`showApiError` 가 돌려준 값을 상태에 담아 `reference` 로 넘기거나, 오류를 `error` 로 넘긴다).
 * 번호는 드래그 한 번에 선택되고, 복사 버튼은 키보드로 닿으며, 복사 결과는 `role="status"` 로 알린다.
 */
export function ErrorReference({
  error,
  reference,
  label = 'Reference',
  copyLabel = 'Copy',
  copiedLabel = 'Copied',
  copyHint,
  className,
}: ErrorReferenceProps) {
  const id = reference ?? errorReferenceOf(error)
  const codeId = useId()
  const codeRef = useRef<HTMLElement>(null)
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  if (!id) return null

  async function copy() {
    try {
      await navigator.clipboard.writeText(id!)
    } catch {
      // 복사 권한 없음 · 비보안 컨텍스트 — 번호를 선택해 둔다(사용자가 직접 복사한다)
      const code = codeRef.current
      if (code) window.getSelection()?.selectAllChildren(code)
      return
    }
    setCopied(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(false), COPIED_VISIBLE_MS)
  }

  return (
    <span className={[styles.root, className].filter(Boolean).join(' ')}>
      <span className={styles.label}>{label}</span>
      <code id={codeId} ref={codeRef} className={styles.code}>
        {id}
      </code>
      <button
        type="button"
        className={styles.copy}
        aria-describedby={codeId}
        title={copyHint}
        onClick={copy}
      >
        {copyLabel}
      </button>
      <span role="status" className={styles.status}>
        {copied ? copiedLabel : ''}
      </span>
    </span>
  )
}
