import type { ApiClient } from '@skeleton/api-client'
import { createContext } from 'react'

/*
 * 서버 렌더에서는 모듈 전역 클라이언트를 쓰지 않는다 — 요청마다(서버) · 앱마다(브라우저) 만든 클라이언트를 이 컨텍스트로 내려준다.
 * 모듈 전역 싱글턴은 서버에서 요청 사이에 상태가 섞인다(토큰 · 캐시).
 */
export const ApiContext = createContext<Pick<ApiClient, 'value'> | null>(null)
