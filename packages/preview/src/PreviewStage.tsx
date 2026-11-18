import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { useBridgeHeight, useBridgeModal } from './bridgeState'
import {
  DEFAULT_PC_WIDTH,
  deviceViewport,
  type DeviceViewport,
  type PcWidth,
  type PreviewDevice,
} from './devices'
import { frameInsets, paintedBox } from './frame'
import type { PreviewLabels } from './labels'
import { defaultPreviewLabels } from './labels.en'
import { PreviewScreen } from './PreviewScreen'
import { outerScrollTop, visibleWindow } from './scroll'
import type { PreviewSource } from './source'
import { useStageSpace } from './useStageSpace'
import { fitScale } from './zoom'
import styles from './PreviewStage.module.css'

export type PcZoom = 'fit' | 'actual'

export type PreviewStageProps = {
  source: PreviewSource
  device: PreviewDevice
  /** 기본 1280 */
  pcWidth?: PcWidth
  /** PC 만 — 'actual' 이면 1:1 로 그리고 칸 안에서 가로로 민다(이름 있는 영역). 기본 'fit' */
  pcZoom?: PcZoom
  onFitPercent?: (percent: number) => void
  /** 무대 높이를 `calc(100lvh - headOffset px)` 로 정하고 기기를 폭 · 높이 모두 맞춘다. 높이를 아는 다리면 펴진다 */
  phone?: boolean
  /** 진짜 폰 화면 — 폰 틀을 걷고, 높이를 아는 다리면 펴진다 */
  bare?: boolean
  /** 정해진 높이 칸 — 높이도 재서 맞춘다 */
  fitHeight?: boolean
  /** 틀 없이 칸 폭 그대로(배율 1, 최소 320) */
  fluid?: boolean
  /** 바깥 스크롤 상자가 `scrollRef` — 높이를 아는 다리면 펴고 구역 이동도 그 상자를 민다 */
  scrollBox?: boolean
  scrollRef?: RefObject<HTMLElement | null>
  /** 문서 위에 고정된 머리 줄 높이(px). 기본 0 */
  headOffset?: number
  /** PC 창 틀을 그리지 않는다 */
  plainPc?: boolean
  /** 폰 베젤만 걷는다(펴지 않는다) */
  plainPhone?: boolean
  /** 칸이 기기보다 크면 이 배율까지 키운다. 기본 1 */
  maxScale?: number
  /** false 면 Tab 이 안으로 들어가지 않는다(iframe tabindex -1, 직접 렌더는 inert). 기본 true */
  focusable?: boolean
  labels?: PreviewLabels
}

/** 바깥 스크롤 상자를 잠그고 풀어 주는 함수를 돌려준다 — 막대 자리는 비워 둔다(scrollbar-gutter) */
function lockOuterScroll(el: HTMLElement): () => void {
  const before = { overflow: el.style.overflow, gutter: el.style.scrollbarGutter }
  el.style.overflow = 'hidden'
  el.style.scrollbarGutter = 'stable'
  return () => {
    el.style.overflow = before.overflow
    el.style.scrollbarGutter = before.gutter
  }
}

/** 기기 하나를 틀에 담아 칸에 맞춘다. PC 실제 크기는 1:1 로 그리고 칸 안에서 가로로 민다 */
export function PreviewStage({
  source,
  device,
  pcWidth = DEFAULT_PC_WIDTH,
  pcZoom = 'fit',
  onFitPercent,
  phone = false,
  bare = false,
  fitHeight = false,
  fluid = false,
  scrollBox = false,
  scrollRef,
  headOffset = 0,
  plainPc = false,
  plainPhone = false,
  maxScale = 1,
  focusable = true,
  labels = defaultPreviewLabels,
}: PreviewStageProps) {
  const stageRef = useRef<HTMLDivElement>(null)
  const bridge = source.kind === 'frame' ? source.bridge : null
  // 다리가 문서 높이를 알리면 iframe 을 그 높이로 펴 바깥 문서 하나로 스크롤한다 — 안 알리면(직접 렌더 · 높이를 모르는 다리) null 이라 기기 높이 그대로
  const reported = useBridgeHeight(bridge)
  const actual = device === 'pc' && pcZoom === 'actual'
  // 폰 배치면 기기와 상관없이 편다. PC 실제 크기는 가로로 밀어야 해서 안쪽 스크롤을 둔다
  const expandedH = phone || ((bare || scrollBox) && !actual) ? reported : null
  // 가운데 칸이 스크롤 상자면 무대 높이를 재서 맞추지 않는다 — 높이는 문서가 정한다
  const space = useStageSpace(
    stageRef,
    (phone && expandedH == null) || (fitHeight && !bare && !(scrollBox && expandedH != null)),
  )
  const viewport: DeviceViewport = fluid
    ? {
        width: Math.max(320, Math.floor(space.width ?? deviceViewport('phone').width)),
        height: space.height ?? deviceViewport('phone').height,
        frame: 'plain',
      }
    : deviceViewport(device, pcWidth)
  // 펴진 PC 는 창 막대를 그리지 않는다 — 문서 위 자리만 먹는 띠였다
  const kind =
    fluid ||
    ((bare || plainPhone) && viewport.frame === 'phone') ||
    (plainPc && viewport.frame === 'desktop') ||
    (scrollBox && expandedH != null && viewport.frame === 'desktop')
      ? 'plain'
      : viewport.frame
  const insets = frameInsets(kind)
  const outer = {
    // 받침이 양옆으로 나오는 PC 틀은 그만큼 넓게 잰다(PreviewScreen reserveBase 와 짝)
    width: paintedBox(kind, viewport.width + insets.x * 2).width,
    height: (expandedH ?? viewport.height) + insets.top + insets.bottom,
  }
  // 칸은 남는 폭을 다 쓰고 틀은 그 안 가운데 — 배율은 무대가 잰 자기 폭(스크롤바 뺀)에 맞춘다
  const fit = fitScale(
    outer,
    { width: space.width ?? 0, height: expandedH == null ? space.height : null },
    maxScale,
  )
  const scale = actual || fluid ? 1 : fit
  const fitPercent = Math.floor(fit * 100)
  useEffect(() => onFitPercent?.(fitPercent), [fitPercent, onFitPercent])

  // 펴진 미리보기에 모달이 열리면 펴기를 풀지 않는다(풀면 바깥 스크롤이 맨 위로 튄다) — iframe 을 지금 보이는 창만큼 줄여 그 자리에 놓고
  // 안쪽 문서를 그 창으로 스크롤한다(`bridge.viewport`). 그러면 모달(fixed · vh)이 보이는 창 가운데에 뜨고 배경은 그대로다. 닫으면 되돌린다
  const modal = useBridgeModal(bridge)
  const [view, setView] = useState<{ top: number; height: number } | null>(null)
  const sentView = useRef(false)
  const fitsView = expandedH != null && modal
  useLayoutEffect(() => {
    if (!fitsView) return
    const stage = stageRef.current
    const slot = stage?.firstElementChild
    if (!stage || !slot) return
    const box = scrollBox ? scrollRef?.current : null
    const viewTop = box ? box.getBoundingClientRect().top : headOffset
    const viewBottom = box ? box.getBoundingClientRect().bottom : window.innerHeight
    const frameTop = slot.getBoundingClientRect().top + insets.top * scale
    setView(visibleWindow({ viewTop, viewBottom, frameTop, docH: expandedH ?? 0, scale }))
  }, [fitsView, expandedH, scale, scrollBox, scrollRef, headOffset, insets.top])
  // 모달이 닫혀 있으면 지난 창은 없는 것이다(상태를 지우지 않고 읽을 때 걸러, 다시 열리면 위 재측정이 덮는다)
  const shownView = fitsView ? view : null
  useEffect(() => {
    if (shownView) {
      bridge?.viewport?.(shownView.top)
      sentView.current = true
    } else if (sentView.current) {
      bridge?.viewport?.(null)
      sentView.current = false
    }
  }, [bridge, shownView])
  // 모달이 열린 동안 바깥(가운데 칸 · 문서) 스크롤을 잠근다 — 배경이 움직이지 않게. 막대 자리는 비워 둔다(scrollbar-gutter)
  useEffect(() => {
    if (!fitsView) return
    const el = scrollBox && scrollRef?.current ? scrollRef.current : document.documentElement
    return lockOuterScroll(el)
  }, [fitsView, scrollBox, scrollRef])

  // 펴진 미리보기의 「구역으로 가기」 — 안쪽이 스크롤되지 않으니 바깥 문서를 대상 위 끝이 머리 줄 밑에 오게 민다
  useEffect(() => {
    if (expandedH == null) return
    return bridge?.onScrollTo?.((top, room) => {
      const stage = stageRef.current
      const frame = stage?.querySelector('iframe')
      if (!stage || !frame) return
      const box = scrollBox ? scrollRef?.current : null
      if (box) {
        // 스크롤 상자는 가운데 칸 — 머리 줄은 칸 밖이라 헤드 여유가 없다
        box.scrollTo({
          top: outerScrollTop({
            scrollY: box.scrollTop,
            frameTop: frame.getBoundingClientRect().top - box.getBoundingClientRect().top,
            top,
            room,
            scale,
            headH: 0,
          }),
          behavior: 'instant',
        })
        return
      }
      window.scrollTo({
        top: outerScrollTop({
          scrollY: window.scrollY,
          frameTop: frame.getBoundingClientRect().top,
          top,
          room,
          scale,
          headH: headOffset,
        }),
        behavior: 'instant',
      })
    })
  }, [bridge, expandedH, scale, scrollBox, scrollRef, headOffset])

  // 청이 첫 그림보다 빨라 못 간 스크롤 — 높이가 알려져 iframe 이 펴진(위 그림이 끝난) 뒤에 한 번 더 보낸다
  const heightKnown = reported != null
  useEffect(() => {
    if (heightKnown) bridge?.flushScroll?.()
  }, [bridge, heightKnown])

  // 실제 크기: 틀이 칸보다 넓으면 가로 스크롤을 가운데에 둔다 — 들어올 때 · 폭을 바꿀 때, 사용자가 밀기 전까지 칸 폭 변화도 따라간다
  const centered = useRef(true)
  const lastSet = useRef(0)
  const mode = useRef('')
  useLayoutEffect(() => {
    const stage = stageRef.current
    if (!actual || !stage) {
      mode.current = ''
      return
    }
    if (mode.current !== `${pcWidth}`) {
      mode.current = `${pcWidth}`
      centered.current = true
    }
    if (!centered.current) return
    lastSet.current = Math.max(0, Math.round((stage.scrollWidth - stage.clientWidth) / 2))
    stage.scrollLeft = lastSet.current
  }, [actual, pcWidth, space.width, outer.width, scale])

  return (
    <div
      ref={stageRef}
      className={styles.stage}
      style={phone && expandedH == null ? { height: `calc(100lvh - ${headOffset}px)` } : undefined}
      data-scroll={actual || undefined}
      data-phone={phone || undefined}
      data-expanded={expandedH != null || undefined}
      tabIndex={actual ? 0 : undefined}
      role={actual ? 'region' : undefined}
      aria-label={actual ? labels.pcScroll : undefined}
      onScroll={(event) => {
        if (Math.abs(event.currentTarget.scrollLeft - lastSet.current) > 1) centered.current = false
      }}
    >
      <PreviewScreen
        source={source}
        width={viewport.width}
        height={expandedH ?? viewport.height}
        scale={scale}
        kind={kind}
        focusable={focusable}
        title={labels.frameTitle}
        view={shownView}
        reserveBase
      />
    </div>
  )
}
