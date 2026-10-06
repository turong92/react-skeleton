import type { ReactNode } from 'react'
import styles from './auth.module.css'

/*
 * 소셜 제공자의 모양 — 코드 → 작은 인라인 SVG 마크. 어떤 제공자가 있는지 · 어떤 순서인지는 백엔드(`GET /auth/methods`)가 정하고,
 * 여기는 아는 코드(google · line · x · kakao · naver)에 마크를 붙일 뿐이다. 모르는 코드는 중립 마크 + 코드 그대로의 이름.
 * 마크만 브랜드 색을 가진다(단색 X 는 글자색을 따라 다크 모드에서도 보인다). 버튼 자체는 앱의 토큰 버튼이다 — 브랜드 색 전체 버튼이 필요하면 `SocialProviderButton.icon` · `label` 로 앱이 바꾼다.
 */

const mark = (code: string, viewBox: string, children: ReactNode) => (
  <svg
    className={styles.providerIcon}
    data-provider={code}
    viewBox={viewBox}
    aria-hidden="true"
    focusable="false"
  >
    {children}
  </svg>
)

const MARKS: Readonly<Record<string, ReactNode>> = {
  // Google "G" — 네 가지 색을 그대로(바꾸지 않는다는 것이 Google 지침)
  google: mark(
    'google',
    '0 0 48 48',
    <>
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </>,
  ),
  // LINE — 초록 바탕에 흰 말풍선
  line: mark(
    'line',
    '0 0 24 24',
    <>
      <rect width="24" height="24" rx="5" fill="#06C755" />
      <path
        fill="#FFFFFF"
        d="M12 5C7.58 5 4 7.9 4 11.48c0 3.2 2.84 5.88 6.68 6.39.26.06.61.17.7.4.08.2.05.52.03.72l-.11.68c-.03.2-.16.79.69.43.85-.36 4.58-2.7 6.25-4.62C19.4 14.2 20 12.9 20 11.48 20 7.9 16.42 5 12 5z"
      />
    </>,
  ),
  // X — 한 색(글자색): 라이트에서는 검정, 다크에서는 흰색
  x: mark(
    'x',
    '0 0 24 24',
    <path
      fill="currentColor"
      d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"
    />,
  ),
  // Kakao — 노란 바탕에 말풍선
  kakao: mark(
    'kakao',
    '0 0 24 24',
    <>
      <rect width="24" height="24" rx="5" fill="#FEE500" />
      <path
        fill="#191919"
        d="M12 5.5c-4.14 0-7.5 2.63-7.5 5.87 0 2.1 1.4 3.94 3.5 4.97l-.9 3.3c-.08.28.24.5.48.34l3.9-2.58c.17.01.34.02.52.02 4.14 0 7.5-2.63 7.5-5.87S16.14 5.5 12 5.5z"
      />
    </>,
  ),
  // Naver — 초록 바탕에 흰 N
  naver: mark(
    'naver',
    '0 0 24 24',
    <>
      <rect width="24" height="24" rx="5" fill="#03C75A" />
      <path fill="#FFFFFF" d="M13.56 12.7 10.2 7.7H7.5v8.6h2.94v-5l3.36 5h2.7V7.7h-2.94z" />
    </>,
  ),
}

/** 아는 코드가 아니면 브랜드 없는 중립 마크(바깥 원 + 사람) */
const NEUTRAL = mark(
  'unknown',
  '0 0 24 24',
  <>
    <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="1.8" />
    <circle cx="12" cy="9.5" r="3" fill="currentColor" />
    <path d="M6.5 18c.8-2.6 3-4 5.5-4s4.7 1.4 5.5 4" fill="currentColor" />
  </>,
)

export const KNOWN_PROVIDER_CODES: readonly string[] = Object.keys(MARKS)

export function providerPresentation(code: string): { icon: ReactNode } {
  return { icon: MARKS[code] ?? NEUTRAL }
}
