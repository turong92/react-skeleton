import { useEffect, useRef, useState } from 'react'
import { copyText } from './copyText'
import styles from './CopyButton.module.css'

export type CopyButtonProps = {
  /** 복사할 글자 — 화면에 그리지 않는다 */
  value: string
  /** 버튼 글자(기본 `Copy`) */
  label?: string
  /** 복사한 뒤 잠깐 보이고 낭독되는 글자(기본 `Copied`) */
  copiedLabel?: string
  /** 복사에 실패했을 때(기본 `Copy failed`) */
  failedLabel?: string
  /** 「복사됨」을 보이는 시간(ms, 기본 2000) */
  resetMs?: number
  onCopy?: (copied: boolean) => void
}

/** 글자를 클립보드로 — 결과는 같은 자리에서 낭독(`role="status"`)되고 잠시 뒤 되돌아온다 */
export function CopyButton({
  value,
  label = 'Copy',
  copiedLabel = 'Copied',
  failedLabel = 'Copy failed',
  resetMs = 2000,
  onCopy,
}: CopyButtonProps) {
  const [result, setResult] = useState<'idle' | 'copied' | 'failed'>('idle')
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])

  async function copy() {
    const ok = await copyText(value)
    setResult(ok ? 'copied' : 'failed')
    onCopy?.(ok)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setResult('idle'), resetMs)
  }

  return (
    <span className={styles.root}>
      <button
        type="button"
        className={styles.button}
        data-result={result}
        onClick={() => void copy()}
      >
        {result === 'copied' ? copiedLabel : label}
      </button>
      <span role="status" className={styles.srOnly}>
        {result === 'copied' ? copiedLabel : result === 'failed' ? failedLabel : ''}
      </span>
    </span>
  )
}
