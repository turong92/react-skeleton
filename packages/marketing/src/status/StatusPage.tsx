import { formatInstant } from '@skeleton/time'
import { ErrorReference } from '@skeleton/ui'
import type { ReactNode } from 'react'
import { useHydrated } from '../useHydrated'
import styles from './StatusPage.module.css'

export type StatusPageProps = {
  /** 큰 상태 번호(404 · 500) — 장식이라 낭독에서 빠진다 */
  code?: string
  title: string
  description?: string
  /** 다음에 할 일 — 보통 홈으로 가는 링크 · 다시 시도 버튼 */
  actions?: ReactNode
  /** 설명 아래 덧붙일 것(참조 번호 · 예상 시각) */
  children?: ReactNode
  /** 통째로 상태 알림이어야 하면(점검 화면) */
  role?: 'status' | 'alert'
}

/** 상태 화면 한 장 — 404 · 500 · 점검의 공통 틀. 제목이 `h1`. 글자는 모두 prop */
export function StatusPage({ code, title, description, actions, children, role }: StatusPageProps) {
  return (
    <section className={styles.root} role={role}>
      {code && (
        <p className={styles.code} aria-hidden="true">
          {code}
        </p>
      )}
      <h1 className={styles.title}>{title}</h1>
      {description && <p className={styles.description}>{description}</p>}
      {children}
      {actions && <div className={styles.actions}>{actions}</div>}
    </section>
  )
}

type PresetProps = { title?: string; description?: string; actions?: ReactNode }

/** 404 — 이유를 말하고 갈 곳(`actions`)을 준다. 페이지 자체의 `noindex` 는 앱의 SEO 가 맡는다(SPA 는 HTTP 404 를 못 낸다) */
export function NotFoundPage({
  title = 'Page not found',
  description = 'The page you are looking for does not exist or has moved.',
  actions,
  code = '404',
}: PresetProps & { code?: string }) {
  return <StatusPage code={code} title={title} description={description} actions={actions} />
}

/** 500 — 사과하고, 문의할 때 줄 참조 번호(traceId)를 보인다(없으면 안 보인다) */
export function ServerErrorPage({
  title = 'Something went wrong',
  description = 'It is on our side. Please try again in a moment.',
  actions,
  reference,
  referenceLabel,
  copyLabel,
  copiedLabel,
}: PresetProps & {
  reference?: string
  referenceLabel?: string
  copyLabel?: string
  copiedLabel?: string
}) {
  return (
    <StatusPage code="500" title={title} description={description} actions={actions}>
      {reference && (
        <ErrorReference
          reference={reference}
          label={referenceLabel}
          copyLabel={copyLabel}
          copiedLabel={copiedLabel}
        />
      )}
    </StatusPage>
  )
}

/** 점검 중 — `role="status"`. 돌아올 시각(`until`, ISO `…Z`)을 알면 그 시간대의 글자로(약속하지 않으면 생략) */
export function MaintenancePage({
  title = 'We will be right back',
  description = 'We are doing some maintenance.',
  actions,
  until,
  zone,
  locale,
  untilLabel = (time) => `Expected back around ${time}`,
}: PresetProps & {
  until?: string
  zone?: string
  locale?: string
  untilLabel?: (formattedTime: string) => string
}) {
  const hydrated = useHydrated()
  // 시간대 · 로케일을 정하지 않으면 보는 기기의 것이라 서버 렌더와 어긋난다 — 그때는 이어받은 뒤에 그린다
  const showTime = until && ((zone && locale) || hydrated)
  return (
    <StatusPage role="status" title={title} description={description} actions={actions}>
      {showTime && (
        <p className={styles.until}>{untilLabel(formatInstant(until, { zone, locale }))}</p>
      )}
    </StatusPage>
  )
}
