import { Alert, Button, Field, MarkdownView, Select, type MarkdownFacts } from '@skeleton/ui'
import { formatWhen } from './format'
import { mergeLegalLabels, type LegalLabels } from './labels'
import type { LegalDocument } from './types'
import styles from './LegalDocumentView.module.css'

export type LegalDocumentViewProps = {
  document: LegalDocument
  /** 서버가 지금 효력 있는 판이라고 한 것 — 옛 판을 읽을 때 「현재 판 보기」가 가리킨다 */
  currentVersion?: string
  /** 효력이 나중에 시작되는 판(공지) — `GET /documents` 의 `next` */
  upcoming?: { version: string; effectiveFrom: string } | null
  /** 판 고르기에 보일 판들(현재 판 · 내가 동의한 판 …) — 서버에는 판 목록 엔드포인트가 없어 앱이 아는 것을 준다. 둘 이상이면 선택 상자 */
  versions?: readonly string[]
  onVersionChange?: (version: string) => void
  /** 마크다운의 `{{키}}` 를 채우는 사실 — 서버가 이미 채워 보내므로 보통 필요 없다 */
  facts?: MarkdownFacts
  /** 문서 제목을 이 화면의 `h1` 로 보일지(다이얼로그는 자기 제목이 있어 false) */
  showTitle?: boolean
  /** 마크다운의 `#` 가 몇 단계 내려갈지(제목 `h1` 아래면 1 — 다이얼로그 `h2` 아래면 2) */
  headingOffset?: number
  /** 날짜 서식 */
  locale?: string
  zone?: string
  labels?: Partial<LegalLabels>
}

/**
 * 서버가 준 문서 한 건을 그린다 — 제목 · 판 · 효력일 · (옛 판 · 예정 판 · 샘플 · 다른 언어) 안내 · 본문(`MarkdownView`, 날 HTML 없음).
 * 문서 불러오기는 모른다(`ApiLegalDocumentPage` · `DocumentDialog` 가 한다).
 */
export function LegalDocumentView({
  document: doc,
  currentVersion,
  upcoming,
  versions,
  onVersionChange,
  facts,
  showTitle = true,
  headingOffset = 1,
  locale = 'en-US',
  zone = 'UTC',
  labels: given,
}: LegalDocumentViewProps) {
  const labels = mergeLegalLabels(given)
  const date = (iso: string) => formatWhen(iso, { locale, zone })
  const choices = [...new Set([...(versions ?? []), doc.version])]
  const otherLanguage = !!doc.requestedLocale && doc.requestedLocale !== doc.locale
  return (
    <article className={styles.root}>
      {doc.template && <Alert tone="warning">{labels.sampleText}</Alert>}
      <header className={styles.header}>
        {showTitle && <h1>{doc.title}</h1>}
        <p className={styles.meta}>
          {labels.version(doc.version)} · {labels.effective(date(doc.effectiveFrom))}
        </p>
        {choices.length > 1 && onVersionChange && (
          <div className={styles.switcher}>
            <Field label={labels.switcher}>
              {(control) => (
                <Select
                  {...control}
                  value={doc.version}
                  onChange={(event) => onVersionChange(event.target.value)}
                >
                  {choices.map((version) => (
                    <option key={version} value={version}>
                      {labels.version(version)}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
        )}
      </header>
      {!doc.current && currentVersion && (
        <Alert
          tone="warning"
          action={
            onVersionChange && (
              <Button size="sm" variant="secondary" onClick={() => onVersionChange(currentVersion)}>
                {labels.viewCurrent}
              </Button>
            )
          }
        >
          {labels.olderNotice(currentVersion)}
        </Alert>
      )}
      {doc.current && upcoming && (
        <Alert tone="info">
          {labels.upcomingNotice(upcoming.version, date(upcoming.effectiveFrom))}
        </Alert>
      )}
      {otherLanguage && <Alert tone="info">{labels.otherLanguage(doc.locale)}</Alert>}
      <MarkdownView
        source={doc.markdown}
        facts={facts}
        headingOffset={headingOffset}
        newTabLabel={labels.newTab}
        idPrefix={`${doc.type}-${doc.version.replace(/[^\p{L}\p{N}]+/gu, '-')}-`}
      />
    </article>
  )
}
