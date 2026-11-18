import { useEffect, useRef, type CSSProperties } from 'react'
import { useBridgeFront } from './bridgeState'
import { DeviceFrame } from './DeviceFrame'
import { frameInsets, paintedBox, type FrameKind } from './frame'
import { PREVIEW_SANDBOX, type PreviewSource } from './source'
import styles from './PreviewScreen.module.css'

type Props = {
  source: PreviewSource
  /** 화면(기기 뷰포트) 크기 */
  width: number
  height: number
  scale: number
  /** 기기 틀 모양 — 폰 · 태블릿은 베젤, PC 는 얇은 모니터(베젤 + 받침), plain 은 틀 없이 */
  kind: FrameKind
  /** false 면 Tab 이 안으로 들어가지 않는다(iframe tabindex=-1, 직접 렌더는 inert) — 휠 · 터치 스크롤은 그대로 */
  focusable?: boolean
  /** iframe 이름 */
  title: string
  /**
   * 펴진 미리보기에 모달이 열린 동안의 보이는 창 — iframe 을 이 높이로 줄여 `top`(iframe 안 px) 자리에 놓는다. 자리 상자 · 기기 틀은 그대로라 바깥 스크롤이 안 튀고,
   * iframe 뷰포트 = 보이는 창이라 모달(`fixed` · `vh`)이 화면에 맞게 뜬다
   */
  view?: { top: number; height: number } | null
  /**
   * PC 틀의 받침이 양옆으로 나오는 만큼 자리 상자를 넓혀 틀이 자리 밖으로 안 나가게 한다(`paintedBox`).
   * 부르는 쪽이 칸에 맞춰 줄일 때도 같은 `paintedBox().width` 로 재야 한다
   */
  reserveBase?: boolean
}

/**
 * 화면 하나를 기기 틀에 담는다 — iframe(`frame` 갈래) 또는 같은 번들의 내용(`render` 갈래).
 * 기기를 바꿔도 같은 요소라 다시 싣지 않는다 — 크기와 배율만 바뀐다. 크게 보기도 같은 컴포넌트를 쓴다 — `scale` 만 다르다
 */
export function PreviewScreen({
  source,
  width,
  height,
  scale,
  kind,
  focusable = true,
  title,
  view = null,
  reserveBase = false,
}: Props) {
  const bridge = source.kind === 'frame' ? source.bridge : null
  const layered = source.kind === 'frame' && (source.layered ?? false)
  const sandbox = source.kind === 'frame' ? (source.sandbox ?? PREVIEW_SANDBOX) : PREVIEW_SANDBOX
  const frameRef = useRef<HTMLIFrameElement>(null)
  const spareRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    const frame = frameRef.current
    if (!bridge || !frame) return
    return bridge.attach(frame, spareRef.current ?? undefined)
  }, [bridge, layered])

  // 바꿔 끼운 뒤에는 둘째 iframe 이 앞이다
  const swapped = useBridgeFront(bridge, spareRef)

  const insets = frameInsets(kind)
  const outerWidth = width + insets.x * 2
  const outerHeight = height + insets.top + insets.bottom

  const frontStyle: CSSProperties = view
    ? { width, height: view.height, position: 'relative', top: view.top }
    : { width, height }
  // 뒤 층은 같은 자리에 겹쳐 투명하게 — 화면 안에 있어야 그려진다(화면 밖은 브라우저가 그리기를 멈춘다)
  const backStyle: CSSProperties = {
    width,
    height: view?.height ?? height,
    position: 'absolute',
    left: 0,
    top: view?.top ?? 0,
    opacity: 0,
    pointerEvents: 'none',
  }

  const frameProps = (front: boolean) => ({
    title: front ? title : undefined,
    'aria-hidden': front ? undefined : true,
    inert: front ? undefined : true,
    className: styles.frame,
    sandbox,
    referrerPolicy: 'no-referrer' as const,
    tabIndex: front && focusable ? undefined : -1,
    width,
    height: view?.height ?? height,
    style: front ? frontStyle : backStyle,
  })

  // 불변 조건: 화면은 늘 기기 뷰포트 크기 — 줄이는 것은 바깥 상자의 transform 뿐이고
  // 자리 상자는 줄인 크기만큼만 차지한다. 폭을 줄여 다시 배치(꾸김)하지 않는다
  const painted = reserveBase ? paintedBox(kind, outerWidth) : { left: 0, width: outerWidth }
  return (
    <div
      className={styles.slot}
      style={{ width: painted.width * scale, height: outerHeight * scale }}
    >
      <DeviceFrame
        kind={kind}
        screen={{ width, height }}
        style={{
          transform: painted.left
            ? `translateX(${painted.left * scale}px) scale(${scale})`
            : `scale(${scale})`,
        }}
      >
        {source.kind === 'render' ? (
          <div
            className={styles.render}
            data-source="render"
            style={{ width, height }}
            inert={focusable ? undefined : true}
          >
            {source.content}
          </div>
        ) : (
          <>
            <iframe ref={frameRef} {...frameProps(!swapped)} />
            {layered && <iframe ref={spareRef} {...frameProps(swapped)} />}
          </>
        )}
      </DeviceFrame>
    </div>
  )
}
