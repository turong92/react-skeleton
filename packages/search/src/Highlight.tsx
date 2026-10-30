import { Fragment } from 'react'
import { splitHighlights } from './splitHighlights'
import styles from './Highlight.module.css'
import type { HighlightRange } from './types'

export type HighlightProps = {
  text: string
  /** 서버의 `titleHighlights` · `snippetHighlights` - `[시작, 끝)` UTF-16 위치 */
  ranges: readonly HighlightRange[]
}

/** 문자열에서 일치한 곳을 `<mark>` 로 - 문자열은 HTML 이 아니라 글자로만 그린다(React 가 이스케이프) */
export function Highlight({ text, ranges }: HighlightProps) {
  return (
    <>
      {splitHighlights(text, ranges).map((part, index) =>
        part.mark ? (
          <mark key={index} className={styles.mark}>
            {part.text}
          </mark>
        ) : (
          <Fragment key={index}>{part.text}</Fragment>
        ),
      )}
    </>
  )
}
