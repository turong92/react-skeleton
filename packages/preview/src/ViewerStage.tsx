import type { FrameKind } from './frame'
import type { PreviewLabels } from './labels'
import { PreviewScreen } from './PreviewScreen'
import type { PreviewSource } from './source'
import type { PanZoom } from './usePanZoom'
import styles from './PreviewViewer.module.css'

type Props = {
  source: PreviewSource
  zoom: PanZoom
  stageRef: (el: HTMLElement | null) => void
  screen: { width: number; height: number }
  kind: FrameKind
  /** `zoom.pan`(칸 기준)에 더할 몫 */
  offset: { x: number; top: number }
  /** 만지기 — 켜면 화면 위 막을 걷어 휠 · 손가락 · 클릭이 안으로 간다 */
  touch: boolean
  /** 조작 안내 줄의 id — 있을 때만 무대 설명으로 건다 */
  describedBy?: string
  /** 무대에서 첫 끌기 · 휠 · 키 조작 */
  onInteract: () => void
  /** 꽉 찬 폰 — 배율 1 · 이동 없음(키로 배율이 바뀌어도 그림은 그대로) */
  fluid?: boolean
  labels: PreviewLabels
}

/**
 * 크게 보기 무대 — 기기 틀에 담긴 화면 한 장. 배율 · 이동은 `usePanZoom` 이 무대에 바인딩하고,
 * 만지기가 꺼져 있으면 화면 위 막이 끌기 · 두 손가락 · Ctrl/⌘+휠을 받는다(브라우저 확대로 새지 않게)
 */
export function ViewerStage({
  source,
  zoom,
  stageRef,
  screen,
  kind,
  offset,
  touch,
  describedBy,
  onInteract,
  fluid = false,
  labels,
}: Props) {
  return (
    <div
      className={styles.stage}
      tabIndex={0}
      role="group"
      aria-label={labels.stage}
      aria-describedby={describedBy}
      data-pannable={zoom.pannable}
      data-scroll={touch || fluid}
      {...zoom.bind}
      onPointerDownCapture={onInteract}
      onWheel={onInteract}
      onKeyDownCapture={onInteract}
      ref={stageRef}
    >
      <div
        className={styles.canvas}
        data-canvas
        style={{
          transform: fluid
            ? 'translate(0px, 0px)'
            : `translate(${zoom.pan.x + offset.x}px, ${zoom.pan.y + offset.top}px)`,
        }}
      >
        <PreviewScreen
          source={source}
          width={screen.width}
          height={screen.height}
          scale={fluid ? 1 : zoom.scale}
          kind={kind}
          focusable={touch}
          title={labels.frameTitle}
        />
      </div>
      {!touch && !fluid && <div className={styles.shield} data-zoom-shield aria-hidden />}
    </div>
  )
}
