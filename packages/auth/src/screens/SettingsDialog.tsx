import { Dialog } from '@skeleton/ui'
import { useEffect, useRef, type ReactNode } from 'react'

/**
 * 설정의 입력 동작이 뜨는 모달 대화상자. 열려 있는 동안에만 안의 양식을 그린다 - 닫으면 입력 · 단계가 버려지고 다시 열면 처음부터다(구역 자리는 그대로라 뒤 페이지가 밀리지 않는다).
 * 포커스 가두기 · Esc · 닫으면 연 단추로 포커스 되돌리기는 `@skeleton/ui` 의 `Dialog` 가 한다. 열리면 첫 입력 칸으로 포커스를 옮긴다(없으면 `Dialog` 의 기본)
 */
export function SettingsDialog({
  open,
  onClose,
  title,
  closeLabel,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  closeLabel: string
  children: ReactNode
}) {
  const body = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (open)
      body.current
        ?.querySelector<HTMLElement>('input:not([type="hidden"]):not(:disabled), select, textarea')
        ?.focus()
  }, [open])
  return (
    <Dialog open={open} onClose={onClose} title={title} closeLabel={closeLabel}>
      {open ? <div ref={body}>{children}</div> : null}
    </Dialog>
  )
}
