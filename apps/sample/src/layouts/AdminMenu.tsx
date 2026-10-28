import { Button } from '@skeleton/ui'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import styles from './AdminMenu.module.css'

/**
 * 운영 메뉴 - 운영 화면 링크를 「운영」 하나로 묶는 드롭다운. 운영자는 링크가 많아(대시보드 · 결제 · 계정 · 역할 · 이벤트 · 쿠폰 · 포인트 · 지급)
 * 상단 메뉴가 알림 · 로그아웃 · 언어 단추를 덮었다. 좁은 화면(헤더가 줄을 바꾸고 메뉴가 가로로 밀리는 때)에는 단추 없이 링크가 그대로 늘어선다.
 * 링크는 닫혀 있어도 문서에 있다 - 단추가 열고 닫는 것은 보이기뿐이다(Esc · 바깥 누름 · 이동하면 닫힌다).
 */
export function AdminMenu({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const panelId = useId()
  const { pathname } = useLocation()

  // 화면을 옮기면 닫는다(그리는 중에 상태를 맞춘다 - effect 안에서 상태를 바꾸지 않는다)
  const [seen, setSeen] = useState(pathname)
  if (seen !== pathname) {
    setSeen(pathname)
    setOpen(false)
  }

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPointer)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPointer)
    }
  }, [open])

  return (
    <div className={styles.menu} data-open={open ? 'true' : 'false'} ref={root}>
      <Button
        variant="secondary"
        size="sm"
        className={styles.trigger}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((now) => !now)}
      >
        {label} <span aria-hidden="true">▾</span>
      </Button>
      <div id={panelId} className={styles.panel}>
        {children}
      </div>
    </div>
  )
}
