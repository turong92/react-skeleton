import { useEffect, useRef, useState, type MouseEvent } from 'react'
import styles from './SectionIndex.module.css'

export type SectionIndexItem = {
  /** 가리키는 절(`SectionCard`)의 id */
  id: string
  label: string
  /** 이름 뒤에 붙는 작은 수(항목 수 · 할 일 수) */
  count?: number
}

export type SectionIndexProps = {
  items: SectionIndexItem[]
  /** `nav` 의 이름(예 「이 페이지」) */
  label: string
  /** 누른 절로 가기 직전 — 접힌 절을 펼치는 자리 */
  onJump?: (id: string) => void
}

/**
 * 긴 화면의 절 목차 — 앵커 칩의 `nav`. 누르면 그 절로 스크롤하고 절 제목(`${id}-title`)으로 포커스를 옮긴다(키보드 · 낭독 사용자가 도착을 안다).
 * 화면 위쪽에 걸린 절은 `aria-current="location"`(IntersectionObserver 가 없으면 건너뛴다). JavaScript 없이도 `href="#id"` 로 동작한다.
 */
export function SectionIndex({ items, label, onJump }: SectionIndexProps) {
  const [current, setCurrent] = useState<string | null>(null)
  const idsKey = items.map((item) => item.id).join('\n')
  /** 방금 목차로 간 절 — 사용자가 직접 스크롤(휠 · 터치 · 키 · 포인터)하기 전까지는 관찰자가 「현재」를 덮어쓰지 못한다 */
  const jumped = useRef<string | null>(null)

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return
    const ids = idsKey.split('\n')
    const visible = new Map<string, boolean>()
    // 화면 위쪽 40% 띠에 걸린 절 가운데 문서 순서로 첫 절
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) visible.set(entry.target.id, entry.isIntersecting)
        // 관찰자의 보고는 비동기라 점프 **전** 상태를 늘 늦게 싣고 올 수 있다 — 방금 누른 절을 되돌리지 않는다
        if (jumped.current) return
        const first = ids.find((id) => visible.get(id))
        if (first) setCurrent(first)
      },
      { rootMargin: '0px 0px -60% 0px' },
    )
    for (const id of ids) {
      const section = document.getElementById(id)
      if (section) observer.observe(section)
    }
    const release = () => {
      jumped.current = null
    }
    const events = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const
    for (const name of events) window.addEventListener(name, release, { passive: true })
    return () => {
      observer.disconnect()
      for (const name of events) window.removeEventListener(name, release)
    }
  }, [idsKey])

  function jump(event: MouseEvent<HTMLAnchorElement>, id: string) {
    const section = document.getElementById(id)
    if (!section) return // 앵커 기본 동작에 맡긴다
    event.preventDefault()
    onJump?.(id)
    jumped.current = id
    section.scrollIntoView({ block: 'start' })
    document.getElementById(`${id}-title`)?.focus({ preventScroll: true })
    setCurrent(id)
  }

  return (
    <nav aria-label={label} className={styles.index}>
      <ol className={styles.list}>
        {items.map((item) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              className={styles.link}
              aria-current={current === item.id ? 'location' : undefined}
              onClick={(event) => jump(event, item.id)}
            >
              <span>{item.label}</span>
              {item.count !== undefined && <span className={styles.count}>{item.count}</span>}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  )
}
