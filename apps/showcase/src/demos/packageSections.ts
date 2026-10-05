import type { ComponentType } from 'react'
import { ApiClientDemo } from './ApiClientDemo'
import { AuthDemo } from './AuthDemo'
import { CaptchaDemo } from './CaptchaDemo'
import { NotificationsDemo } from './NotificationsDemo'
import { PaymentDemo } from './PaymentDemo'
import { RealtimeDemo } from './RealtimeDemo'
import { StorageDemo } from './StorageDemo'
import { ThemeDemo } from './ThemeDemo'
import { TimeDemo } from './TimeDemo'

export type PackageSection = {
  /** 주소 조각 — `/packages/<slug>` */
  slug: string
  pkg: string
  title: string
  summary: string
  importLine: string
  Demo: ComponentType
}

/** 새 패키지는 여기 한 줄 + 데모 파일 하나. (tokens 는 `/tokens` 가 따로 보여 준다) */
export const packageSections: PackageSection[] = [
  {
    slug: 'api-client',
    pkg: '@skeleton/api-client',
    title: 'API 클라이언트 — 에러 처리',
    summary: 'envelope · ApiRequestError · 에러 코드. 가짜 어댑터 위의 진짜 클라이언트.',
    importLine: "import { createApiClient, isErrorCode, ErrorCodes } from '@skeleton/api-client'",
    Demo: ApiClientDemo,
  },
  {
    slug: 'auth',
    pkg: '@skeleton/auth',
    title: '인증 — 로그인 폼과 RequireAuth',
    summary: '토큰 저장소 · 세션 · AuthProvider · 라우트 가드. 가짜 AuthApi.',
    importLine: "import { AuthProvider, RequireAuth, useAuth } from '@skeleton/auth'",
    Demo: AuthDemo,
  },
  {
    slug: 'notifications',
    pkg: '@skeleton/notifications',
    title: '알림 — 종과 목록, 실시간 이벤트',
    summary: '받은편지함 훅 · 안 읽은 수 · 가짜 실시간 이벤트를 캐시에 반영.',
    importLine:
      "import { NotificationBell, NotificationList, useNotificationIngest } from '@skeleton/notifications'",
    Demo: NotificationsDemo,
  },
  {
    slug: 'storage',
    pkg: '@skeleton/storage',
    title: '업로드 — 진행률과 취소',
    summary: '검증 → presign → 직접 PUT. 가짜 전송으로 진행률을 본다.',
    importLine: "import { createUploader, useUpload } from '@skeleton/storage'",
    Demo: StorageDemo,
  },
  {
    slug: 'time',
    pkg: '@skeleton/time',
    title: '시간 — 시각 3종과 시간대',
    summary: 'formatInstant · formatDate · ZonedMoment 의 formatDual.',
    importLine: "import { formatInstant, formatDual, toZonedMoment } from '@skeleton/time'",
    Demo: TimeDemo,
  },
  {
    slug: 'theme',
    pkg: '@skeleton/theme',
    title: '테마 — 토글',
    summary: 'system · light · dark. 저장 · 첫 칠 전 스크립트.',
    importLine: "import { ThemeToggle, useTheme, setTheme } from '@skeleton/theme'",
    Demo: ThemeDemo,
  },
  {
    slug: 'captcha-turnstile',
    pkg: '@skeleton/captcha-turnstile',
    title: '캡차 — 가짜 위젯',
    summary: '<Turnstile> · useTurnstileToken · 토큰 붙이기. loader 를 갈아 끼운다.',
    importLine:
      "import { Turnstile, useTurnstileToken, attachTurnstileToken } from '@skeleton/captcha-turnstile'",
    Demo: CaptchaDemo,
  },
  {
    slug: 'payment',
    pkg: '@skeleton/payment',
    title: '결제 — 계약 타입과 리다이렉트 변환',
    summary: '얇은 호출 + 토스 리다이렉트 → confirm 요청.',
    importLine:
      "import { createPaymentApi, confirmRequestFromTossRedirect } from '@skeleton/payment'",
    Demo: PaymentDemo,
  },
  {
    slug: 'realtime',
    pkg: '@skeleton/realtime',
    title: '실시간 — 프로토콜 읽기 · 쓰기',
    summary: 'SSE 블록 · STOMP 프레임 · 재연결 지연. 연결 없이 순수 함수만.',
    importLine:
      "import { parseSseBlock, encodeStompFrame, useSseClient } from '@skeleton/realtime'",
    Demo: RealtimeDemo,
  },
]
