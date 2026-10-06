import { createLegalApi, type LegalApi } from '@skeleton/legal'
import { useMemo } from 'react'
import { useApi } from '../api/useApi'

/** 이 앱(요청)의 API 클라이언트로 만든 법적 문서 API — 서버 렌더 앱은 모듈 전역 API 가 없다 */
export function useLegalApi(): LegalApi {
  const api = useApi()
  return useMemo(() => createLegalApi(api), [api])
}
