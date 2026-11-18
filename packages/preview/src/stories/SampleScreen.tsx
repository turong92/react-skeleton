/** 스토리 전용 — 직접 렌더 갈래(`source.kind === 'render'`)에 넘기는 중립 화면. `fixedBar` 면 바닥에 `position: fixed` 막대 */
export function SampleScreen({ fixedBar = false }: { fixedBar?: boolean }) {
  return (
    <div style={{ minHeight: '100%', background: 'var(--surface)', color: 'var(--text)' }}>
      <h1 style={{ margin: 0, padding: 'var(--space-lg)' }}>Corner Cafe</h1>
      <p style={{ margin: 0, padding: 'var(--space-lg)' }}>A small neighbourhood cafe.</p>
      {fixedBar && (
        <div
          data-testid="fixed-bar"
          style={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 0,
            padding: 'var(--space-md)',
            background: 'var(--inverse)',
            color: 'var(--on-inverse)',
          }}
        >
          Order now
        </div>
      )}
    </div>
  )
}
