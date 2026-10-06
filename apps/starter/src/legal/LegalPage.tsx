import { ApiLegalDocumentPage, koLegalLabels } from '@skeleton/legal'
import { useParams, useSearchParams } from 'react-router-dom'
import { legalApi } from '../api/legal'

/** `/legal/:type` — 서버의 약관 · 방침(`terms` · `privacy` …). 판은 `?version=`(링크로 공유된다) */
export function LegalPage() {
  const { type = '' } = useParams()
  const [params, setParams] = useSearchParams()
  return (
    <ApiLegalDocumentPage
      api={legalApi}
      type={type}
      version={params.get('version') ?? undefined}
      onVersionChange={(version) => setParams(version ? { version } : {}, { replace: true })}
      locale="ko-KR"
      contentLocale="ko"
      labels={koLegalLabels}
    />
  )
}
