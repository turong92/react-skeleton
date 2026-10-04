import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = {
  children: ReactNode
  fallback?: (error: Error, reset: () => void) => ReactNode
}

type State = {
  error: Error | null
}

/**
 * React 렌더링 에러를 잡는 경계 컴포넌트.
 *
 * - 자식 트리에서 throw된 에러를 캐치해서 fallback UI 로 치환
 * - 기본 fallback: 에러 메시지 + 새로고침 버튼
 * - TanStack Query 의 비동기 에러는 여기서 안 잡힘 (각 쿼리에서 `isError` 로 처리 or QueryClient `onError`)
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info)
  }

  reset = () => this.setState({ error: null })

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    if (this.props.fallback) return this.props.fallback(error, this.reset)

    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h2 style={{ color: 'var(--red)' }}>문제가 발생했습니다</h2>
        <pre
          style={{
            display: 'inline-block',
            textAlign: 'left',
            padding: '1rem',
            background: 'var(--red-soft)',
            border: '1px solid var(--red-border)',
            borderRadius: 4,
            maxWidth: 800,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {error.message}
        </pre>
        <div style={{ marginTop: '1rem' }}>
          <button onClick={this.reset}>다시 시도</button>
        </div>
      </div>
    )
  }
}
