import type { ReactNode } from 'react'
import styles from './sections.module.css'

export type FooterLink = { label: string; href: string }
export type FooterColumn = { title: string; links: FooterLink[] }

export type SiteFooterProps = {
  brand: ReactNode
  tagline?: string
  columns?: FooterColumn[]
  /** 약관 · 개인정보 처리방침 같은 법적 링크 — 푸터 맨 아래 줄 */
  legalLinks?: FooterLink[]
  /** 법적 링크 묶음의 이름(필수 — 낭독에 쓰인다) */
  legalLabel?: string
  copyright: string
  /** 맨 끝 자리 — 쿠키 설정 버튼 · 언어 메뉴 */
  extra?: ReactNode
  /** 앱의 라우터 링크로 그리고 싶을 때 */
  renderLink?: (link: FooterLink, children: ReactNode) => ReactNode
}

/**
 * 사이트 푸터 내용 — 브랜드 · 열별 링크(이름 있는 `nav`) · 법적 링크 · 저작권. `AppShell` 의 `footer` 자리에 넣는다(`AppShell` 이 이미 `<footer>` 를 그리므로 이것은 요소를 더하지 않는다).
 */
export function SiteFooter({
  brand,
  tagline,
  columns = [],
  legalLinks = [],
  legalLabel = 'Legal',
  copyright,
  extra,
  renderLink,
}: SiteFooterProps) {
  const link = (item: FooterLink) =>
    renderLink ? (
      renderLink(item, item.label)
    ) : (
      <a href={item.href} className={styles.footerLink}>
        {item.label}
      </a>
    )
  return (
    <div className={styles.footer}>
      <div className={styles.footerTop}>
        <div className={styles.footerBrand}>
          <div className={styles.brandName}>{brand}</div>
          {tagline && <p className={styles.footerText}>{tagline}</p>}
        </div>
        {columns.map((column) => (
          <nav key={column.title} aria-label={column.title} className={styles.footerColumn}>
            <p className={styles.footerHeading} aria-hidden="true">
              {column.title}
            </p>
            <ul className={styles.footerList}>
              {column.links.map((item) => (
                <li key={item.href + item.label}>{link(item)}</li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className={styles.footerBottom}>
        <p className={styles.footerText}>{copyright}</p>
        {legalLinks.length > 0 && (
          <nav aria-label={legalLabel}>
            <ul className={styles.footerInline}>
              {legalLinks.map((item) => (
                <li key={item.href + item.label}>{link(item)}</li>
              ))}
            </ul>
          </nav>
        )}
        {extra}
      </div>
    </div>
  )
}
