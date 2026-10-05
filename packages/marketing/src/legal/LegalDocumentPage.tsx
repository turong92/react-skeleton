import { formatDate, todayInZone } from '@skeleton/time'
import { Alert, Button, Field, MarkdownView, Select, type MarkdownFacts } from '@skeleton/ui'
import { useState, type ReactNode } from 'react'
import styles from './LegalDocumentPage.module.css'
import { currentVersionOf, sortVersions, type LegalVersion } from './versions'

export type LegalDocumentLabels = {
  version: (version: string) => string
  effective: (formattedDate: string) => string
  /** 판 고르기 선택 상자의 이름 */
  switcher: string
  /** 지금 효력 있는 판이 아닌 옛 판을 읽을 때 */
  olderNotice: (currentVersion: string) => string
  viewCurrent: string
  /** 아직 효력이 시작되지 않은 판을 읽을 때 */
  upcomingNotice: (formattedDate: string) => string
  /** 새 탭 링크 안내(`MarkdownView` 로 전달) */
  newTab: string
}

const DEFAULT_LABELS: LegalDocumentLabels = {
  version: (version) => `Version ${version}`,
  effective: (date) => `Effective ${date}`,
  switcher: 'Version',
  olderNotice: (current) =>
    `You are reading an older version. Version ${current} is the one in effect.`,
  viewCurrent: 'Read the current version',
  upcomingNotice: (date) => `This version takes effect on ${date}.`,
  newTab: '(opens in a new tab)',
}

export type LegalDocumentPageProps = {
  /** 문서 이름(페이지의 `h1`) */
  title: string
  /** 판마다 효력일 + 마크다운. 효력일이 늦은 판이 현재 판이다(`today` 기준) */
  versions: LegalVersion[]
  /** 제어하려면(예: 주소의 `?v=`) — 없으면 현재 판으로 시작해 안에서 쥔다 */
  selectedVersion?: string
  onVersionChange?: (version: string) => void
  /** 마크다운의 `{{키}}` 를 채우는 사실(회사명 · 연락처 …) */
  facts?: MarkdownFacts
  /** 날짜 서식의 로케일 — 명시한다(서버 렌더와 같아야 한다) */
  locale?: string
  /** 오늘 `YYYY-MM-DD`(기본: UTC 의 오늘) — 어느 판이 현재 판인가를 정한다 */
  today?: string
  /** 문서 위의 큰 안내 — 템플릿 문서는 「법률 검토 전 템플릿」을 여기 */
  templateNotice?: ReactNode
  labels?: Partial<LegalDocumentLabels>
}

/**
 * 법적 문서(약관 · 개인정보 처리방침) 페이지 — 버전이 있는 마크다운을 효력일과 함께 보여 주고, 판이 둘 이상이면 판 바꾸기(옛 판은 「현재 판 아님」 안내 + 현재 판으로 가는 길).
 * 본문은 `MarkdownView`(날 HTML 없음 · 안전한 링크 · `{{키}}` 채우기). 문서 제목이 이 페이지의 `h1` 이므로 마크다운에는 제목을 쓰지 않고, 마크다운의 `#`(절)가 `h2` 로 내려온다.
 */
export function LegalDocumentPage({
  title,
  versions,
  selectedVersion,
  onVersionChange,
  facts,
  locale = 'en-US',
  today = todayInZone('UTC'),
  templateNotice,
  labels: given,
}: LegalDocumentPageProps) {
  const labels = { ...DEFAULT_LABELS, ...given }
  const [internal, setInternal] = useState<string | undefined>(undefined)
  const sorted = sortVersions(versions)
  const current = currentVersionOf(versions, today)
  const chosen = selectedVersion ?? internal ?? current?.version
  const shown = sorted.find((version) => version.version === chosen) ?? current
  const date = (iso: string) => formatDate(iso, { locale })
  const select = (version: string) => {
    setInternal(version)
    onVersionChange?.(version)
  }

  return (
    <article className={styles.root}>
      {templateNotice && (
        <Alert tone="warning" title={undefined}>
          {templateNotice}
        </Alert>
      )}
      <header className={styles.header}>
        <h1>{title}</h1>
        {shown && (
          <p className={styles.meta}>
            {labels.version(shown.version)} · {labels.effective(date(shown.effectiveDate))}
          </p>
        )}
        {sorted.length > 1 && shown && (
          <div className={styles.switcher}>
            <Field label={labels.switcher}>
              {(control) => (
                <Select
                  {...control}
                  value={shown.version}
                  onChange={(event) => select(event.target.value)}
                >
                  {sorted.map((version) => (
                    <option key={version.version} value={version.version}>
                      {labels.version(version.version)} — {date(version.effectiveDate)}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
        )}
      </header>
      {shown && current && shown.version !== current.version && (
        <Alert
          tone={shown.effectiveDate > today ? 'info' : 'warning'}
          action={
            <Button size="sm" variant="secondary" onClick={() => select(current.version)}>
              {labels.viewCurrent}
            </Button>
          }
        >
          {shown.effectiveDate > today
            ? labels.upcomingNotice(date(shown.effectiveDate))
            : labels.olderNotice(current.version)}
        </Alert>
      )}
      {shown && (
        <MarkdownView
          source={shown.markdown}
          facts={facts}
          headingOffset={1}
          newTabLabel={labels.newTab}
          idPrefix={`${shown.version.replace(/[^\p{L}\p{N}]+/gu, '-')}-`}
        />
      )}
    </article>
  )
}
