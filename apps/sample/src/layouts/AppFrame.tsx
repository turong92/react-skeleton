import { RootLayout } from './RootLayout'
import { PageSeo } from '../seo/PageSeo'

/** 모든 라우트의 바깥 — 화면마다 머리(SEO)를 맞추고 공통 틀(RootLayout)을 그린다. `RootLayout` 자체는 라우터 데이터 없이도 그려진다(단위 테스트) */
export function AppFrame() {
  return (
    <>
      <PageSeo />
      <RootLayout />
    </>
  )
}
