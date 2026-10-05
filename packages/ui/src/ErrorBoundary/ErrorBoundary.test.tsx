import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ErrorBoundary } from './ErrorBoundary'

/*
 * 서버 렌더에서는 에러 경계가 던진 자식을 잡지 않는다 — 에러 상태를 만든 인스턴스의 render() 를 직접 그려 fallback 을 본다.
 */
function crashed(props: ConstructorParameters<typeof ErrorBoundary>[0], message = 'boom') {
  const boundary = new ErrorBoundary(props)
  boundary.state = ErrorBoundary.getDerivedStateFromError(new Error(message))
  return boundary
}

describe('ErrorBoundary', () => {
  it('renders its children while nothing failed', () => {
    expect(renderToStaticMarkup(<ErrorBoundary>fine</ErrorBoundary>)).toBe('fine')
  })

  it('the default fallback shows the message with English default texts', () => {
    const html = renderToStaticMarkup(<>{crashed({ children: 'x' }, 'kaboom').render()}</>)
    expect(html).toContain('kaboom')
    expect(html).toContain('Something went wrong')
    expect(html).toContain('Try again')
  })

  it('title and retry label are props so a project can translate them', () => {
    const html = renderToStaticMarkup(
      <>
        {crashed({ children: 'x', title: '문제가 발생했습니다', retryLabel: '다시 시도' }).render()}
      </>,
    )
    expect(html).toContain('문제가 발생했습니다')
    expect(html).toContain('다시 시도')
    expect(html).not.toContain('Something went wrong')
  })

  it('a custom fallback gets the error and a reset function', () => {
    const boundary = crashed({
      children: 'x',
      fallback: (error, reset) => <button onClick={reset}>retry {error.message}</button>,
    })
    expect(renderToStaticMarkup(<>{boundary.render()}</>)).toContain('retry boom')
  })

  it('reset clears the error', () => {
    const boundary = crashed({ children: 'x' })
    boundary.setState = (update) => {
      boundary.state = { ...boundary.state, ...(update as object) }
    }
    boundary.reset()
    expect(boundary.state.error).toBeNull()
  })
})
