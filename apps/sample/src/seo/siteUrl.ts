/** 사이트의 공개 주소(`https://notes.example.com`) — canonical · og:url · sitemap.xml 의 바탕. 앱이 환경변수에서 읽는다(패키지는 읽지 않는다). 없으면 그 태그는 빠진다 */
export const SITE_URL: string | undefined =
  (import.meta.env.VITE_SITE_URL as string | undefined)?.replace(/\/+$/, '') || undefined
