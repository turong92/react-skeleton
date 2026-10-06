import { ApiLegalDocumentPage, useLegalDocuments } from '@skeleton/legal'
import { Skeleton } from '@skeleton/ui'
import { useSearchParams } from 'react-router-dom'
import { legalApi } from '../api/legal'
import type { LegalDoc } from '../legal/documents'
import { useLegalLocale } from '../legal/useLegalLocale'
import { LegalPage } from './LegalPage'

/**
 * `/terms` · `/privacy` — 서버(백엔드 legal 모듈)가 그 문서를 갖고 있으면 서버의 마크다운 · 판 · 효력일을 보이고,
 * 서버가 없거나(legal 모듈 없음) 그 문서가 없으면 `src/legal/documents/**` 의 정적 템플릿 파일(`LegalPage`)로 돌아간다 — 백엔드 없는 사이트도 그대로 돈다.
 */
export function LegalRoute({ doc }: { doc: LegalDoc }) {
  const documents = useLegalDocuments(legalApi)
  const [params, setParams] = useSearchParams()
  const { locale, formatLocale, labels } = useLegalLocale()
  if (documents.isPending) return <Skeleton />
  if (!documents.data?.some((d) => d.type === doc)) return <LegalPage doc={doc} />
  return (
    <ApiLegalDocumentPage
      api={legalApi}
      type={doc}
      version={params.get('v') ?? undefined}
      onVersionChange={(version) => setParams(version ? { v: version } : {}, { replace: true })}
      contentLocale={locale}
      locale={formatLocale}
      labels={labels}
    />
  )
}
