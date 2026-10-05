import { useState, type ReactNode } from 'react'
import styles from './SectionCard.module.css'

export type SectionCardProps = {
  /** 절 id — 목차(`SectionIndex`)의 앵커. 제목은 `${id}-title`, 본문은 `${id}-panel` */
  id: string
  title: ReactNode
  /** 제목 아래 흐린 글(접힌 동안은 숨는다) */
  description?: ReactNode
  /** 제목 오른쪽(개수 · 작은 버튼) — 접힌 동안은 숨는다 */
  aside?: ReactNode
  headingLevel?: 2 | 3
  className?: string
  children: ReactNode
  /** 접기 모드 — 제목이 펼침 버튼이 된다 */
  collapsible?: boolean
  /** 제어: 펼침 여부(`onToggle` 과 함께) */
  expanded?: boolean
  /** 비제어: 처음에 펼쳐 둘지(기본 true) */
  defaultExpanded?: boolean
  onToggle?: (expanded: boolean) => void
  /** 접힌 머리의 요약 한 줄 */
  summary?: ReactNode
}

/**
 * 설정 · 긴 폼의 한 절. 제목은 `tabIndex=-1` 이라 목차가 눌렀을 때 포커스를 옮길 수 있다.
 * 접기 모드면 제목이 `h2 > button[aria-expanded][aria-controls]` 이고, 본문은 접혀도 마운트된 채 `hidden` 이라 입력 상태가 남는다.
 */
export function SectionCard({
  id,
  title,
  description,
  aside,
  headingLevel = 2,
  className,
  children,
  collapsible = false,
  expanded: expandedProp,
  defaultExpanded = true,
  onToggle,
  summary,
}: SectionCardProps) {
  const [inner, setInner] = useState(defaultExpanded)
  const expanded = !collapsible || (expandedProp ?? inner)
  const Heading = headingLevel === 3 ? 'h3' : 'h2'
  const titleId = `${id}-title`
  const descriptionId = `${id}-description`
  const summaryId = `${id}-summary`
  const panelId = `${id}-panel`
  const showDescription = Boolean(description) && expanded
  const showSummary = collapsible && !expanded && summary !== undefined && summary !== ''

  function toggle() {
    const next = !expanded
    if (expandedProp === undefined) setInner(next)
    onToggle?.(next)
  }

  return (
    <section
      id={id}
      aria-labelledby={titleId}
      aria-describedby={showDescription ? descriptionId : undefined}
      className={[styles.section, className].filter(Boolean).join(' ')}
      data-collapsible={collapsible ? 'true' : undefined}
      data-expanded={collapsible ? String(expanded) : undefined}
    >
      <div className={styles.head}>
        <div className={styles.heading}>
          <Heading
            className={styles.title}
            id={collapsible ? undefined : titleId}
            tabIndex={collapsible ? undefined : -1}
          >
            {collapsible ? (
              <button
                type="button"
                id={titleId}
                className={styles.toggle}
                aria-expanded={expanded}
                aria-controls={panelId}
                aria-describedby={showSummary ? summaryId : undefined}
                onClick={toggle}
              >
                <span>{title}</span>
                <svg
                  className={styles.chevron}
                  viewBox="0 0 16 16"
                  width="16"
                  height="16"
                  aria-hidden="true"
                  focusable="false"
                >
                  <path
                    d="M4 6l4 4 4-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            ) : (
              title
            )}
          </Heading>
          {showDescription && (
            <p id={descriptionId} className={styles.description}>
              {description}
            </p>
          )}
          {showSummary && (
            <p id={summaryId} className={styles.summary}>
              {summary}
            </p>
          )}
        </div>
        {aside && expanded && <div className={styles.aside}>{aside}</div>}
      </div>
      <div id={panelId} className={styles.panel} hidden={!expanded}>
        {children}
      </div>
    </section>
  )
}
