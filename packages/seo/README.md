# @skeleton/seo

검색 · 링크 미리보기를 위한 **문서의 머리(`<head>`)** — 제목 템플릿 · 설명 · canonical · Open Graph · Twitter · JSON-LD · robots — 와 빌드 때 만드는 `sitemap.xml` · `robots.txt`. SPA(effect 로 브라우저 문서를 맞춘다)와 SSR(서버가 첫 응답의 머리를 글자로 쓴다)이 **같은 규칙**(`buildHeadSpec`)을 쓴다. 백엔드가 필요 없고 새 런타임 의존이 없다(`react` 만 peer).

```tsx
// 앱 루트(SPA) — 사이트 기본값 한 번
<SeoProvider defaults={{ siteName: 'Notes', titleTemplate: '%s · Notes', baseUrl: SITE_URL, description: '…', locale: 'ko_KR' }}>…</SeoProvider>

// 화면마다 한 줄 (아무것도 그리지 않는다)
<Seo title="요금" description="…" canonical="/pricing" jsonLd={faqLd(items)} />
<Seo title="계정" robots="noindex, nofollow" />
```

| export                                                                        | 뜻                                                                                                                                                                                    |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `buildHeadSpec(meta, defaults)`                                               | `{ title, tags }` — 제목 템플릿(`%s`) · 설명 · canonical(절대 · `#해시` 버림) · `og:*` · `twitter:*`(이미지가 있으면 큰 카드) · hreflang · JSON-LD. 순수 함수                         |
| `renderHeadHtml(spec)`                                                        | **서버용** — `<title>` + 태그 글자(이스케이프됨, 태그마다 `data-seo`). 서버 렌더 템플릿의 머리 자리에 넣는다                                                                          |
| `applyHead(spec, document)`                                                   | **브라우저용** — 제목을 바꾸고 `data-seo` 태그만 갈아 끼운다(charset · viewport · 테마 스크립트는 그대로, 쌓이지 않는다)                                                              |
| `SeoProvider` · `Seo` · `useSeo(meta)`                                        | 위 둘을 React 에서. effect 라 서버에서는 아무 일도 안 한다                                                                                                                            |
| `organizationLd` · `webSiteLd` · `breadcrumbLd` · `faqLd` · `serializeJsonLd` | schema.org 조각. `serializeJsonLd` 는 `< > &` 와 U+2028/9 를 이스케이프해 값에 `</script>` 가 있어도 스크립트를 빠져나가지 못한다                                                     |
| `sitemapXml(entries, { baseUrl })` · `robotsTxt(options)`                     | 순수 함수. 같은 호스트의 절대 주소만, 중복 · 해시 제거, `lastmod`/`priority` 검사, 5만 개 한도, robots 의 줄을 늘리는 값(개행)은 던진다. `allowIndexing: false` 로 스테이징 전체 차단 |
| `@skeleton/seo/vite` 의 `seoFiles({ baseUrl, routes, robots })`               | 정적 빌드가 `sitemap.xml` · `robots.txt` 를 함께 낸다(Vite 플러그인 꼴). `baseUrl` 이 없으면 robots.txt 만 내고 경고                                                                  |

## 서버 렌더에서

서버 렌더 스타터 앱의 서버는 요청마다 `renderHeadHtml(buildHeadSpec(meta, defaults))` 로 머리를 쓰고, 브라우저는 하이드레이션 뒤 라우트가 바뀔 때 `applyHead` 로 이어 간다(같은 `data-seo` 표식이라 서버가 쓴 태그를 갈아 끼운다). 첫 응답에 canonical · OG 가 있어야 링크 미리보기 크롤러가 읽는다(그들은 JS 를 돌리지 않는다) — SPA 는 이 점에서 한계가 있다.

## 규칙

- 절대 주소가 필요한 것(canonical · `og:image` · 사이트맵)은 `baseUrl` 이 있어야 만들어진다. 없으면 그 태그를 **빼고** 틀린 주소를 쓰지 않는다. `baseUrl` 은 앱이 환경변수(`SITE_URL`)에서 읽어 넘긴다 — 패키지는 `import.meta.env` 를 읽지 않는다.
- 사이트맵에는 **공개** 페이지만. 로그인 뒤 · 계정 · 결제는 넣지 않고 그 화면은 `robots: 'noindex'`.
- 스테이징 · 미리보기 빌드는 `robots: { allowIndexing: false }` 로 전부 막는다.
- 다른 `@skeleton/*` 패키지를 쓰지 않는다 — 폴더만 복사해도 된다. 스토리: `src/Seo.stories.tsx`(진짜 `<head>` 를 읽어 확인).
