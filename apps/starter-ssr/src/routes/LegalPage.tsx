import { ApiLegalDocumentPage, koLegalLabels } from '@skeleton/legal'
import { useParams, useSearchParams } from 'react-router-dom'
import { useLegalApi } from '../legal/useLegalApi'

/** `/legal/:type` — 서버의 약관 · 방침. 판은 `?version=`(링크로 공유된다). 서버가 쥔 문서라 첫 HTML 이 아니라 하이드레이션 뒤에 채워진다 */
export function LegalPage() {
  const { type = '' } = useParams()
  const [params, setParams] = useSearchParams()
  return (
    <ApiLegalDocumentPage
      api={useLegalApi()}
      type={type}
      version={params.get('version') ?? undefined}
      onVersionChange={(version) => setParams(version ? { version } : {}, { replace: true })}
      locale="ko-KR"
      contentLocale="ko"
      labels={koLegalLabels}
    />
  )
}
