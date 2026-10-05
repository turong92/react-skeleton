import type { ApiClient } from '@skeleton/api-client'
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../api/client'

export type HelloResponse = {
  message: string
  timestamp: string
}

/** 쿼리 정의(키 + 함수)를 훅과 따로 둬서 클라이언트만 바꿔 테스트한다. 새 엔드포인트는 이 모양을 복사한다 */
export function helloQuery(client: Pick<ApiClient, 'value'>) {
  return {
    queryKey: ['hello'] as const,
    queryFn: () => client.value<HelloResponse>('/hello'),
  }
}

/** `GET /api/v1/hello` — 백엔드 연결 확인용 예시 */
export function useHello() {
  return useQuery(helloQuery(apiClient))
}
