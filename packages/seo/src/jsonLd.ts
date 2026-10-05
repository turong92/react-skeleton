export type JsonLdNode = { '@type': string } & Record<string, unknown>

/**
 * `<script type="application/ld+json">` 안에 넣을 JSON 글자. `<` `>` `&` 와 줄 구분 문자(U+2028/2029)를 유니코드 이스케이프해
 * 값에 `</script>` · `<!--` 가 있어도 스크립트 요소를 빠져나가지 못한다(되돌리면 같은 값).
 */
export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
}

export const organizationLd = (input: {
  name: string
  url: string
  logo?: string
  sameAs?: string[]
}): JsonLdNode => ({ '@type': 'Organization', ...input })

export const webSiteLd = ({
  name,
  url,
  searchUrlTemplate,
}: {
  name: string
  url: string
  /** 사이트 검색 주소 — `{query}` 자리에 검색어. 있으면 검색 상자 힌트가 붙는다 */
  searchUrlTemplate?: string
}): JsonLdNode => ({
  '@type': 'WebSite',
  name,
  url,
  ...(searchUrlTemplate
    ? {
        potentialAction: {
          '@type': 'SearchAction',
          target: searchUrlTemplate,
          'query-input': 'required name=query',
        },
      }
    : {}),
})

export const breadcrumbLd = (items: Array<{ name: string; url: string }>): JsonLdNode => ({
  '@type': 'BreadcrumbList',
  itemListElement: items.map((item, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: item.name,
    item: item.url,
  })),
})

export const faqLd = (items: Array<{ question: string; answer: string }>): JsonLdNode => ({
  '@type': 'FAQPage',
  mainEntity: items.map((item) => ({
    '@type': 'Question',
    name: item.question,
    acceptedAnswer: { '@type': 'Answer', text: item.answer },
  })),
})
