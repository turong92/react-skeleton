import { Alert, Button, Skeleton, type MarkdownFacts } from '@skeleton/ui'
import { useLegalDocument, useLegalDocuments } from './hooks'
import { mergeLegalLabels, type LegalLabels } from './labels'
import type { LegalApi } from './legalApi'
import { LegalDocumentView } from './LegalDocumentView'

export type ApiLegalDocumentPageProps = {
  api: LegalApi
  /** 문서 종류(`terms` · `privacy` …) */
  type: string
  /** 보여 줄 판(주소의 `?version=` 등) — 없으면 현재 판 */
  version?: string
  /** 읽을 언어 — 없으면 서버의 기본 언어 */
  contentLocale?: string
  onVersionChange?: (version: string | undefined) => void
  /** 판 고르기에 더 올릴 판(예: 내가 동의한 판) */
  extraVersions?: readonly string[]
  facts?: MarkdownFacts
  /** 날짜 서식 로케일 · 시간대 */
  locale?: string
  zone?: string
  labels?: Partial<LegalLabels>
}

/**
 * 백엔드의 문서를 페이지로 — `GET /legal/documents/{type}` 을 읽어 판 바꾸기 · 효력일 · 옛 판/예정 판 안내와 함께 보인다.
 * 서버가 알려 주는 것은 현재 판과 `next` 뿐이라 판 고르기는 현재 판 + `extraVersions`(내가 동의한 판)이다. 백엔드가 없는 사이트는 `@skeleton/marketing` 의 `LegalDocumentPage`(정적 파일).
 */
export function ApiLegalDocumentPage({
  api,
  type,
  version,
  contentLocale,
  onVersionChange,
  extraVersions = [],
  facts,
  locale,
  zone,
  labels: given,
}: ApiLegalDocumentPageProps) {
  const labels = mergeLegalLabels(given)
  const doc = useLegalDocument(api, type, { version, locale: contentLocale })
  const list = useLegalDocuments(api)
  const summary = list.data?.find((d) => d.type === type)
  if (doc.isPending)
    return (
      <div aria-busy="true">
        <Skeleton />
      </div>
    )
  if (doc.isError || !doc.data)
    return (
      <Alert
        tone="danger"
        action={
          <Button size="sm" variant="secondary" onClick={() => void doc.refetch()}>
            {labels.retry}
          </Button>
        }
      >
        {labels.documentFailed}
      </Alert>
    )
  return (
    <LegalDocumentView
      document={doc.data}
      currentVersion={summary?.version}
      upcoming={summary?.next ?? null}
      versions={[...(summary ? [summary.version] : []), ...extraVersions]}
      onVersionChange={
        onVersionChange &&
        ((next) => onVersionChange(summary && next === summary.version ? undefined : next))
      }
      facts={facts}
      locale={locale}
      zone={zone}
      labels={given}
    />
  )
}
