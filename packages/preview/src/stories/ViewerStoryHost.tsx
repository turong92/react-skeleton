import { Button, Select } from '@skeleton/ui'
import { useEffect, useState } from 'react'
import { PreviewViewer, type PreviewViewerExtra, type PreviewViewerProps } from '../PreviewViewer'
import type { PreviewSource } from '../source'
import { createFakeFrameBridge } from '../test/fakeFrameBridge'
import { sampleHtml } from './sampleHtml'

/** 직접 렌더 갈래의 확인용 — 누른 횟수가 기기를 바꿔도 남고, 안쪽 입력칸 · 스크롤 상자가 무대에 가로채이지 않아야 한다 */
function CounterScreen() {
  const [count, setCount] = useState(0)
  return (
    <div style={{ padding: 'var(--space-lg)', background: 'var(--surface)', color: 'var(--text)' }}>
      <h1 style={{ margin: 0 }}>Corner Cafe</h1>
      <Button onClick={() => setCount((n) => n + 1)}>Count: {count}</Button>
      <input aria-label="Note" style={{ display: 'block', marginTop: 'var(--space-md)' }} />
      {/* 화면 안 자기 스크롤 상자 — 크게 보기에서 읽을 수 있어야 한다 */}
      <div
        data-testid="inner-scroll"
        tabIndex={0}
        role="region"
        aria-label="Lines"
        style={{ height: 120, overflow: 'auto' }}
      >
        {Array.from({ length: 30 }, (_, i) => (
          <p key={i}>Line {i + 1}</p>
        ))}
      </div>
    </div>
  )
}

/** 앱이 꽂는 보기 조건의 예 — 막대 · 판에는 고르기, 알약에는 요약 글 */
const EXTRA: PreviewViewerExtra = {
  bar: (
    <Select aria-label="View mode" defaultValue="day">
      <option value="day">Daytime</option>
      <option value="night">Night</option>
    </Select>
  ),
  panel: (
    <Select aria-label="View mode" defaultValue="day">
      <option value="day">Daytime</option>
      <option value="night">Night</option>
    </Select>
  ),
  summary: ['Daytime'],
}

export type ViewerStoryHostProps = Omit<PreviewViewerProps, 'source'> & {
  /** 직접 렌더 갈래(숫자 단추 화면)로 연다. 기본은 iframe 다리 */
  render?: boolean
  /** `extra`(보기 조건 예)를 꽂는다 */
  withExtra?: boolean
  /** 150ms 뒤 스스로 연다(앞 스토리의 닫힘과 섞이지 않게). false 면 「Open viewer」 단추로만 */
  autoOpen?: boolean
}

/** 스토리 전용 — 뷰어를 열고 닫는 부모. `onClose` 에서 뷰어를 내린다(`as="dialog"` 의 약속) */
export function ViewerStoryHost({
  render = false,
  withExtra = false,
  autoOpen = true,
  onClose,
  ...rest
}: ViewerStoryHostProps) {
  const [open, setOpen] = useState(false)
  const [bridge] = useState(() => createFakeFrameBridge({ html: sampleHtml() }))
  useEffect(() => {
    if (!autoOpen) return
    const id = setTimeout(() => setOpen(true), 150)
    return () => clearTimeout(id)
  }, [autoOpen])
  const source: PreviewSource = render
    ? { kind: 'render', content: <CounterScreen /> }
    : { kind: 'frame', bridge }
  return (
    <>
      <Button onClick={() => setOpen(true)}>Open viewer</Button>
      {open && (
        <PreviewViewer
          {...rest}
          source={source}
          extra={withExtra ? EXTRA : rest.extra}
          onClose={() => {
            onClose()
            setOpen(false)
          }}
        />
      )}
    </>
  )
}
