import { Button, Card, Spinner } from '@skeleton/ui'
import { useHello } from '../hooks/useHello'

export function HomePage() {
  const hello = useHello()
  return (
    <Card
      title="백엔드 연결"
      actions={
        <Button variant="secondary" size="sm" onClick={() => void hello.refetch()}>
          다시 호출
        </Button>
      }
    >
      {hello.isPending && <Spinner label="불러오는 중" />}
      {hello.data && (
        <p>
          <code>GET /hello</code> → {hello.data.message}
        </p>
      )}
      {hello.isError && <p>호출에 실패했습니다. 백엔드가 떠 있는지 확인하세요.</p>}
    </Card>
  )
}
