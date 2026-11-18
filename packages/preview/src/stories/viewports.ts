/** 스토리 전용 — 크게 보기 스토리의 화면 크기. 전역 목록을 덮지 않고 이 패키지 스토리 meta 의 `parameters.viewport` 로만 준다 */
export const PREVIEW_VIEWPORTS = {
  options: {
    phone: { name: 'Phone', styles: { width: '390px', height: '800px' }, type: 'mobile' },
    tablet: { name: 'Tablet', styles: { width: '820px', height: '1180px' }, type: 'tablet' },
    desktop: { name: 'Desktop', styles: { width: '1440px', height: '900px' }, type: 'desktop' },
  },
} as const
