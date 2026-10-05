import { Fragment, type ReactNode } from 'react'
import styles from './Breadcrumbs.module.css'

export type BreadcrumbItem = {
  label: string
  /** 없거나 마지막이면 링크가 아니다 */
  href?: string
}

export type BreadcrumbsProps = {
  /** `nav` 의 이름(필수 · 기본 영어를 두지 않는다 — 화면 언어는 앱이 안다) */
  label: string
  items: BreadcrumbItem[]
  /** 앱의 라우터 링크로 그리고 싶을 때 */
  renderLink?: (item: BreadcrumbItem, children: ReactNode) => ReactNode
}

/** 경로 표시 — `nav` + 순서 목록. 마지막은 현재 페이지(`aria-current="page"`)라 링크가 아니다 */
export function Breadcrumbs({ label, items, renderLink }: BreadcrumbsProps) {
  const last = items.length - 1
  return (
    <nav aria-label={label} className={styles.nav}>
      <ol className={styles.list}>
        {items.map((item, index) => (
          <Fragment key={`${index}:${item.label}`}>
            <li className={styles.item}>
              {index === last || !item.href ? (
                <span aria-current={index === last ? 'page' : undefined} className={styles.current}>
                  {item.label}
                </span>
              ) : renderLink ? (
                renderLink(item, item.label)
              ) : (
                <a href={item.href} className={styles.link}>
                  {item.label}
                </a>
              )}
            </li>
            {index < last && (
              <li className={styles.separator} aria-hidden="true">
                /
              </li>
            )}
          </Fragment>
        ))}
      </ol>
    </nav>
  )
}
