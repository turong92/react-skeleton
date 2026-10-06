import { createAccountApi, createAuthApi, createAuthRoutes, koAuthLabels } from '@skeleton/auth'
import { useMemo } from 'react'
import { useApi } from '../api/useApi'
import { ClientRequireAuth } from './ClientRequireAuth'
import { authMethods, parseDelivery } from './authConfig'

/** 요청마다 · 앱마다 만든 API 클라이언트(컨텍스트)로 인증 · 계정 API 를 만든다 — 서버 렌더 앱은 모듈 전역 API 가 없다 */
function useApis() {
  const api = useApi()
  return useMemo(
    () => ({
      authApi: createAuthApi(api, {
        delivery: parseDelivery(import.meta.env.VITE_AUTH_REFRESH_DELIVERY),
      }),
      accountApi: createAccountApi(api),
    }),
    [api],
  )
}

/**
 * 계정 수명주기 라우트 한 벌(로그인 · 가입 · 메일 확인 · 비밀번호 재설정 · 링크 로그인 · 계정 설정). 메일 링크의 토큰은 브라우저에서만 읽으므로
 * 이 화면들은 하이드레이션 뒤에 그려진다. 계정 설정은 하이드레이션 안전판(`ClientRequireAuth`) 아래.
 * 소셜 로그인을 쓰려면 `createSocialLoginFlow` 를 브라우저에서 만들어 `socialFlow` 로 넘긴다(`createClientApp` 쪽에서 — 이 파일은 서버도 부른다).
 */
export const accountRoutes = (handle?: (page: string) => unknown) =>
  createAuthRoutes({
    session: { getState: () => ({ status: 'anonymous', token: null, principal: null }) },
    useApis,
    methods: { ...authMethods, social: [] },
    labels: koAuthLabels,
    guard: <ClientRequireAuth redirectTo="/login" />,
    settings: {
      locales: [
        { value: 'ko', label: '한국어' },
        { value: 'en', label: 'English' },
      ],
    },
    handle,
  })
