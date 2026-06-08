import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'

type HelloResponse = {
  message: string
  timestamp: string
}

/**
 * 샘플 페이지. 백엔드 `/api/v1/hello` 호출해서 표시.
 * 실제 앱 만들 때 삭제하거나 대체.
 */
export function HomePage() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['hello'],
    queryFn: () => api<HelloResponse>('/hello'),
  })

  return (
    <section>
      <h1>react-skeleton ↔ backend</h1>
      <p>
        <code>GET /api/v1/hello</code> via TanStack Query → Kotlin 백엔드
      </p>

      {isLoading && <p>Loading...</p>}

      {isError && (
        <pre style={{ color: '#c0392b', padding: '1rem', border: '1px solid #c0392b' }}>
          {error instanceof Error ? error.message : String(error)}
        </pre>
      )}

      {data && (
        <div
          style={{
            padding: '1rem',
            border: '1px solid #27ae60',
            borderRadius: 8,
            marginTop: '1rem',
          }}
        >
          <p>
            <strong>message:</strong> {data.message}
          </p>
          <p>
            <strong>timestamp:</strong> <code>{data.timestamp}</code>
          </p>
        </div>
      )}

      <button onClick={() => refetch()} style={{ marginTop: '1rem' }}>
        Refetch
      </button>
    </section>
  )
}
