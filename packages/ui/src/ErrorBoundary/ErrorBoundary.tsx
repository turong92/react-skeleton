import { Component, type ErrorInfo, type ReactNode } from 'react'
import styles from './ErrorBoundary.module.css'

type Props = {
  children: ReactNode
  fallback?: (error: Error, reset: () => void) => ReactNode
  /** 기본 fallback 의 제목(기본 `Something went wrong`) */
  title?: string
  /** 기본 fallback 의 다시 시도 버튼(기본 `Try again`) */
  retryLabel?: string
}

type State = {
  error: Error | null
}

/**
 * React 렌더링 에러를 잡는 경계 컴포넌트.
 *
 * - 자식 트리에서 throw된 에러를 캐치해서 fallback UI 로 치환
 * - 기본 fallback: 에러 메시지 + 다시 시도 버튼(글자는 `title` · `retryLabel` prop)
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
      <div className={styles.fallback} role="alert">
        <h2 className={styles.title}>{this.props.title ?? 'Something went wrong'}</h2>
        <pre className={styles.message}>{error.message}</pre>
        <div className={styles.actions}>
          <button type="button" onClick={this.reset}>
            {this.props.retryLabel ?? 'Try again'}
          </button>
        </div>
      </div>
    )
  }
}
