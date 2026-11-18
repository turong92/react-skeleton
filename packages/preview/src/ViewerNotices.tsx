import { Button } from '@skeleton/ui'
import { Expand, TriangleAlert } from 'lucide-react'
import { useLayoutEffect, useRef } from 'react'
import type { PreviewLabels } from './labels'
import styles from './ViewerNotices.module.css'

type Props = {
  /** 「n% 로 줄여 보는 중 — 실제 크기로 보기」 — 누르면 실제 크기 */
  shrunk: { percent: number; onActual: () => void } | null
  /** 조작 안내 — 만지기 켬 `touch`, 끔은 굵은 포인터면 `panTouch`, 아니면 `pan` */
  hint: 'pan' | 'panTouch' | 'touch' | null
  /** 안내 줄의 id — 무대가 설명으로 건다 */
  hintId?: string
  /** 그리기 실패 — 지난 그림은 그대로 */
  error: string | null
  /** 덜 된 것 안내 */
  warning: string | null
  placement: 'bar' | 'pill'
  /** 축소 알약 글 전체 폭(px)을 알린다 — 줄여 그려져도 말줄임 없는 폭. 알약이 없으면 0 */
  onShrunkWidth?: (width: number) => void
  /** 좁은 결에서 기기 옆(왼쪽 위 바깥)에 자리가 있으면 — 축소 알약이 쌓인 안내를 떠나 기기 위 끝에 붙는다(기기 높이를 잡아먹지 않는다) */
  beside?: { top: number; maxWidth: number } | null
  /** 쌓인 높이를 재는 요소 — 뷰어가 이만큼 맞추기 자리를 더 비운다 */
  measureRef?: (el: HTMLElement | null) => void
  labels: PreviewLabels
}

const HINT_LABEL = { pan: 'hintPan', panTouch: 'hintPanTouch', touch: 'hintTouch' } as const

/** 크게 보기 안내 알약 — 왼쪽 위 축소 알약, 위 가운데는 조작 안내 → 오류 → 안내 순서로 쌓는다 */
export function ViewerNotices({
  shrunk,
  hint,
  hintId,
  error,
  warning,
  placement,
  beside,
  onShrunkWidth,
  measureRef,
  labels,
}: Props) {
  const shrunkBox = useRef<HTMLDivElement>(null)
  // 옆에 둘 수 있는지 가르는 기준 폭 — 알약 밖 여백 + 가장 넓은 자리 숫자(「100%」)로 그린 숨은 복사본의 폭.
  // 실제 배율 숫자로 재면 옆 ↔ 쌓기에서 배율이 바뀔 때 폭이 따라 바뀌어 깜빡일 수 있다. 알약이 바뀔 때만 다시 잰다
  const shrunkPresent = shrunk !== null
  const widestText = labels.shrunk(100)
  // 문구가 바뀌면 다시 재고, 글꼴이 늦게 들어와 폭이 달라지는 경우를 위해 글꼴이 준비된 뒤 한 번 더 잰다
  useLayoutEffect(() => {
    const measure = () => {
      const pill = shrunkBox.current?.firstElementChild
      const text = pill?.querySelector<HTMLElement>('[data-pill-text]')
      const widest = shrunkBox.current?.querySelector<HTMLElement>('[data-shrunk-widest]')
      onShrunkWidth?.(
        pill && text && widest
          ? Math.ceil(pill.getBoundingClientRect().width - text.clientWidth + widest.offsetWidth)
          : 0,
      )
    }
    measure()
    let alive = true
    void document.fonts?.ready.then(() => {
      if (alive) measure()
    })
    return () => {
      alive = false
    }
  }, [shrunkPresent, widestText, onShrunkWidth])
  return (
    <div className={styles.notices} data-placement={placement} data-notices ref={measureRef}>
      {shrunk && (
        <div
          ref={shrunkBox}
          className={styles.shrunk}
          data-beside={placement === 'pill' && beside ? 'true' : undefined}
          style={
            placement === 'pill' && beside
              ? { top: `calc(${beside.top}px - var(--space-md))`, maxWidth: beside.maxWidth }
              : undefined
          }
        >
          <Button
            size="sm"
            variant="secondary"
            className={styles.shrunkButton}
            onClick={shrunk.onActual}
          >
            <Expand aria-hidden size={16} className={styles.pillIcon} />
            <span className={styles.pillText} data-pill-text>
              {labels.shrunk(shrunk.percent)}
            </span>
            <span className={styles.widest} data-shrunk-widest aria-hidden>
              {widestText}
            </span>
          </Button>
        </div>
      )}
      <div className={styles.stack}>
        {hint && (
          <div id={hintId} className={styles.pill}>
            {labels[HINT_LABEL[hint]]}
          </div>
        )}
        {error && (
          <div role="alert" className={styles.pill} data-tone="error">
            <TriangleAlert aria-hidden size={16} className={styles.pillIcon} />
            {error}
          </div>
        )}
        {warning && (
          <div role="status" className={styles.pill} data-tone="warn">
            <TriangleAlert aria-hidden size={16} className={styles.pillIcon} />
            {warning}
          </div>
        )}
      </div>
    </div>
  )
}
