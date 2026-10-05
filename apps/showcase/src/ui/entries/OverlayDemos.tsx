import { useState } from 'react'
import { Button, Dialog, ErrorBoundary } from '@skeleton/ui'
import { Case } from '../../components/Section'

export function DialogDemo() {
  const [open, setOpen] = useState(false)
  return (
    <Case label="native <dialog> — Esc closes, focus stays inside">
      <Button onClick={() => setOpen(true)}>대화상자 열기</Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="확인"
        closeLabel="닫기"
        footer={<Button onClick={() => setOpen(false)}>확인</Button>}
      >
        <p>정말 진행할까요?</p>
      </Dialog>
    </Case>
  )
}

function Bomb({ armed }: { armed: boolean }) {
  if (armed) throw new Error('렌더링 중 에러')
  return <p>아직 멀쩡합니다.</p>
}

export function BoundaryDemo() {
  const [armed, setArmed] = useState(false)
  return (
    <Case label="throw while rendering">
      <ErrorBoundary title="문제가 발생했습니다" retryLabel="다시 시도">
        <Bomb armed={armed} />
        <Button variant="danger" size="sm" onClick={() => setArmed(true)}>
          에러 일으키기
        </Button>
      </ErrorBoundary>
      {armed && (
        <Button variant="ghost" size="sm" onClick={() => setArmed(false)}>
          되돌리기
        </Button>
      )}
    </Case>
  )
}
