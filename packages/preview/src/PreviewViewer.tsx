import { Dialog } from '@skeleton/ui'
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import type { PcWidth, PreviewDevice } from './devices'
import type { PreviewLabels } from './labels'
import { defaultPreviewLabels } from './labels.en'
import { reserveFor, useDropNotices, useNoticeHeight } from './noticeStack'
import type { PreviewSource } from './source'
import {
  COARSE_QUERY,
  PHONE_QUERY,
  SHORT_LANDSCAPE_QUERY,
  WIDE_QUERY,
  useMediaQuery,
} from './useMediaQuery'
import { useScrollLock } from './useScrollLock'
import { keepMeasured, useViewerZoom } from './useViewerZoom'
import { viewerSummary } from './viewerSummary'
import { ViewerBar } from './ViewerBar'
import { ViewerNarrow } from './ViewerNarrow'
import { ViewerNotices } from './ViewerNotices'
import { ViewerStage } from './ViewerStage'
import styles from './PreviewViewer.module.css'

/** 크게 보기의 PC 기본 폭 — 무대(1280)와 달리 1440 */
const VIEWER_PC_WIDTH: PcWidth = 1440

/** 앱이 막대 · 판 · 알약에 꽂는 자기 보기 조건 */
export type PreviewViewerExtra = {
  /** 넓은 결 막대 — 기기 고르기 다음 칸(구분선은 패키지가) */
  bar?: ReactNode
  /** 좁은 결 판 — 기기 · 크기 다음 */
  panel?: ReactNode
  /** 좁은 결 알약 요약 글 조각(기기 · 배율 뒤) — 맞추기일 때만 보인다 */
  summary?: readonly string[]
}

export type PreviewViewerProps = {
  /** 뷰어 자기 화면 — iframe 이면 앱이 뷰어용 다리를 따로 만들어 같은 HTML 을 싣는다 */
  source: PreviewSource
  /** 'dialog' = 전체 화면 모달(Esc · 닫기, `onClose` 에서 뷰어를 내려야 한다), 'page' = 새 창 화면(<main>) */
  as: 'dialog' | 'page'
  /** 창 · 화면 이름(낭독) */
  title: string
  onClose: () => void
  /** 기본 'phone'. 고른 기기 · 배율 · 만지기는 뷰어 안 상태 — 새 source 가 와도 그대로 */
  initialDevice?: PreviewDevice
  /** 기본 1440 */
  pcWidth?: PcWidth
  /** 만지기(안쪽을 눌러 보기) 값 — 그린 뒤 한 번, 바뀔 때마다 */
  onTouchChange?: (on: boolean) => void
  /** 있으면 「다시 재생」 단추 */
  onReplay?: () => void
  /** 있으면 「새 창에서 보기」 단추 */
  onOpenWindow?: () => void
  /** 그리기 실패 안내(지난 그림은 그대로) — role=alert 알약 */
  error?: string | null
  /** 덜 된 것 안내(예: 번역 덜 됨) — role=status 알약 */
  warning?: string | null
  extra?: PreviewViewerExtra
  labels?: PreviewLabels
}

/**
 * 크게 보기 — 기기 넷 · 배율 · 만지기를 고르는 한 무대. 고른 기기 · 배율 · 만지기는 뷰어 안 상태라 새 source 가 와도 그대로다.
 * 넓은 결(≥1024)은 아래 막대, 좁은 결은 위 알약 + 펴기 판 + 배율 패드, 폰 화면의 기기 「폰」은 꽉 찬 화면(틀 · 막 없음 — 만지기는 처음에 켠 채)
 */
export function PreviewViewer({
  source,
  as,
  title,
  onClose,
  initialDevice = 'phone',
  pcWidth = VIEWER_PC_WIDTH,
  onTouchChange,
  onReplay,
  onOpenWindow,
  error = null,
  warning = null,
  extra,
  labels = defaultPreviewLabels,
}: PreviewViewerProps) {
  const hintId = useId()
  const [device, setDevice] = useState<PreviewDevice>(initialDevice)
  // 만지기 — 고르기 전에는 꽉 찬 폰이 켠 채(눌리지 않는 꽉 찬 페이지는 죽어 보인다), 그 밖은 끈 채. 고른 뒤에는 고른 대로
  const [touchChoice, setTouchChoice] = useState<boolean | null>(null)
  const [moved, setMoved] = useState(false)
  const coarse = useMediaQuery(COARSE_QUERY)
  const wide = useMediaQuery(WIDE_QUERY)
  const phoneScreen = useMediaQuery(PHONE_QUERY)
  const shortLandscape = useMediaQuery(SHORT_LANDSCAPE_QUERY)
  const fluid = !wide && device === 'phone' && (phoneScreen || shortLandscape)
  const touch = touchChoice ?? fluid
  const [shrunkWidth, setShrunkWidth] = useState(0)
  // 알약을 뺀 사이의 0 으로 마지막으로 잰 폭을 지우지 않는다(자리 바뀜 없이 같은 함수를 넘긴다)
  const rememberShrunkWidth = useCallback(
    (width: number) => setShrunkWidth((before) => keepMeasured(before, width)),
    [],
  )
  const noticeStack = useNoticeHeight()
  const panelStack = useNoticeHeight()
  // 안내를 빼는 조건은 판을 뺀 자리로 잰다(판은 열고 접는 것이지 안내가 쌓인 것이 아니다)
  const noticeReserve = reserveFor(wide, noticeStack.height)
  const { stage, zoom, stageRef, stageEl, screen, kind, shrunk, offset, beside } = useViewerZoom({
    device,
    pcWidth,
    reserve: noticeReserve,
    panel: wide ? 0 : panelStack.height,
    // 판이 열린 동안은 알약 · 패드가 없다 — 기기를 판 밑으로 내릴 때는 그 자리까지 쓴다
    panelReserve: reserveFor(false, noticeStack.height, true),
    shrunkWidth,
    fluid,
    // 직접 렌더 + 만지기: 화면 안 스크롤 · 입력칸이 무대에 가로채이지 않게
    passThrough: touch && source.kind === 'render',
  })

  const touchChangeRef = useRef(onTouchChange)
  useEffect(() => {
    touchChangeRef.current = onTouchChange
  })
  useEffect(() => {
    touchChangeRef.current?.(touch)
  }, [touch])

  useScrollLock(as === 'dialog')

  // 모달이 열리면 무대로 포커스, 내려가면 연 단추로 돌려준다 — 포커스가 문서 맨 위로 떨어지지 않게
  // 렌더 중에 활성 요소를 읽는 이유: 효과 시점에는 하위 Dialog 가 이미 showModal 로 포커스를 안으로 옮겨 연 단추를 알 수 없다. 서버에는 document 가 없어 null
  const [opener] = useState(() =>
    typeof document === 'undefined' ? null : (document.activeElement as HTMLElement | null),
  )
  useEffect(() => {
    if (as !== 'dialog') return
    stageEl.current?.focus()
    return () => {
      if (opener?.isConnected) opener.focus()
    }
  }, [as, opener, stageEl])

  // 조작 안내 — 꽉 찬 폰은 없음. 쌓인 높이가 화면 절반을 넘으면 안내부터 뺀다(한 번 뺀 것은 화면 · 알약이 바뀔 때까지)
  const wanted = fluid
    ? null
    : touch
      ? ('touch' as const)
      : moved
        ? null
        : coarse
          ? ('panTouch' as const)
          : ('pan' as const)
  // 쌓인 아래 끝(위 여백 12 뺀 noticeReserve.top)이 화면 절반을 넘으면 조작 안내 → 축소 알약 순서로 뺀다.
  // 기기 옆에 선 축소 알약은 쌓인 높이에 들지 않으니 빼는 차례에서만 제외한다. 서명에는 옆 ↔ 쌓기가 아닌 원래 값 `shrunk` 를 둔다
  // (옆 · 쌓기가 서명을 바꾸면 뺀 알약이 되살아나 다시 재는 순환이 생긴다)
  const shrunkStacked = shrunk && (wide || beside === null)
  const dropped = useDropNotices(
    stage.height > 0 && noticeReserve.top - 12 > stage.height / 2,
    noticeStack.stamp,
    [...(wanted !== null ? ['hint' as const] : []), ...(shrunkStacked ? ['shrunk' as const] : [])],
    `${stage.width}x${stage.height}|${wanted}|${shrunk}|${error !== null}|${warning !== null}`,
  )
  const hint = dropped.has('hint') ? null : wanted

  const setDeviceKeepingFit = (next: PreviewDevice) => {
    setDevice(next)
    // 맞추기는 새 기기에서 다시 가운데로
    if (zoom.mode === 'fit') zoom.setScale('fit')
  }
  const changeTouch = (on: boolean) => {
    setTouchChoice(on)
    // 끄면 막이 돌아오고 포커스는 무대로 — 안쪽에 있던 포커스가 갈 곳을 잃지 않게
    if (!on) stageEl.current?.focus()
  }
  const notices = {
    shrunk:
      shrunk && !dropped.has('shrunk')
        ? { percent: Math.round(zoom.scale * 100), onActual: () => zoom.setScale('actual') }
        : null,
    hint,
    hintId,
    error,
    warning,
    beside: wide ? null : beside,
    onShrunkWidth: rememberShrunkWidth,
    measureRef: noticeStack.ref,
  }

  const content = (
    <div className={styles.root}>
      <ViewerStage
        source={source}
        zoom={zoom}
        stageRef={stageRef}
        screen={screen}
        kind={kind}
        offset={offset}
        touch={touch}
        fluid={fluid}
        describedBy={hint && !(!wide && panelStack.height > 0) ? hintId : undefined}
        onInteract={() => setMoved(true)}
        labels={labels}
      />
      {wide ? (
        <>
          <ViewerNotices {...notices} placement="bar" labels={labels} />
          <ViewerBar
            device={device}
            onDevice={setDeviceKeepingFit}
            zoom={zoom}
            extra={extra?.bar}
            touch={touch}
            onTouch={changeTouch}
            onReplay={onReplay}
            onOpenWindow={onOpenWindow}
            onClose={onClose}
            labels={labels}
          />
        </>
      ) : (
        <ViewerNarrow
          summary={viewerSummary({
            device,
            fit: zoom.mode === 'fit',
            percent: Math.round(zoom.scale * 100),
            extra: extra?.summary,
          })}
          device={device}
          onDevice={setDeviceKeepingFit}
          zoom={zoom}
          panelExtra={extra?.panel}
          touch={touch}
          onTouch={changeTouch}
          onReplay={onReplay}
          onOpenWindow={onOpenWindow}
          onClose={onClose}
          fluid={fluid}
          notices={notices}
          panelRef={panelStack.ref}
          labels={labels}
        />
      )}
    </div>
  )

  if (as === 'page') {
    return (
      <main className={styles.page} aria-label={title}>
        {content}
      </main>
    )
  }
  return (
    <Dialog open fullScreen title={title} onClose={onClose} closeLabel={labels.close}>
      {content}
    </Dialog>
  )
}
