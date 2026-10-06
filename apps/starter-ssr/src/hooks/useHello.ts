import type { ApiClient } from '@skeleton/api-client'
import { useQuery } from '@tanstack/react-query'
import { useApi } from '../api/useApi'

export type HelloResponse = {
  message: string
  timestamp: string
}

/**
 * 쿼리 정의(키 + 함수)를 훅과 따로 둬서 — 서버 렌더가 같은 정의로 미리 가져오고(`prefetchQuery`),
 * 브라우저 훅이 같은 키로 받아 쓴다(하이드레이션). 새 엔드포인트는 이 모양을 복사한다
 */
export function helloQuery(client: Pick<ApiClient, 'value' | 'list' | 'noContent' | 'page'>) {
  return {
    queryKey: ['hello'] as const,
    queryFn: () => client.value<HelloResponse>('/hello'),
  }
}

/** `GET /api/v1/hello` — 백엔드 연결 확인용 예시. 서버가 채워 보낸 데이터가 있으면 바로 그것을 쓴다 */
export function useHello() {
  return useQuery(helloQuery(useApi()))
}
