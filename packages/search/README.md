# @skeleton/search

전문 검색 사용자 화면 한 벌 — 머리말 검색창, 결과 화면, 일치한 글자 강조. 백엔드 `modules/search`(+ `search-jdbc`)의 HTTP 짝이다(`GET /api/v1/search`). 운영 재색인 화면은 없다(서버 `POST /api/v1/admin/search/rebuild` 는 HTTP 만).

```tsx
const api = createSearchApi(apiClient) // 기본 경로 /search

// 머리말: 제출하면 앱이 /search?q= 로 보낸다
<SearchBox labels={labels} onSearch={(q) => navigate(`/search?q=${encodeURIComponent(q)}`)} />

// 결과 화면 - QueryClientProvider 아래에서
<SearchResults
  api={api}
  query={q}
  types={['note', 'product']} // 거르기 칩으로 내놓을 종류(둘 이상일 때만 그린다)
  describe={(type) =>
    type === 'product'
      ? { label: '상품', href: (id) => `/products/${id}` }
      : { label: '노트', href: (id) => `/notes/${id}` }
  }
  renderLink={(href, children) => <Link to={href}>{children}</Link>}
  labels={koSearchLabels}
/>
```

패키지는 어떤 종류의 문서가 있는지 모른다 — 이름과 링크는 앱이 `describe(type) → { label, href(id) }` 로 준다. 라우터도 모른다(`renderLink` 기본은 일반 `<a>`). 문구는 영어 기본(`defaultSearchLabels`), `koSearchLabels`, 일부만 바꾸려면 `resolveSearchLabels({ box: { label: '…' } })`.

| 내보내기                                | 하는 일                                                                                                                                                                                   |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `createSearchApi(client, { basePath })` | `search({ q, types, scope, sort, page, size })` → 쪽 envelope. 값이 있는 조건만 보낸다(`types` 는 쉼표로 묶는다). 서버 `skeleton.search.http.base-path` 와 `basePath` 를 맞춘다           |
| `useSearch(api, params, { delayMs })`   | 입력이 멈출 때까지 늦추고(기본 300ms) 그 값으로만 묻는다 · 2글자 미만이면 묻지 않는다(`searchable: false`) · 새 조건을 가져오는 동안 앞 쪽을 보여 준다. `{ query, searchable, settling }` |
| `isSearchable(q)`                       | 글자 · 숫자가 이어진 덩어리 중 2글자 이상이 있는가 — 서버(`SearchText`)와 같은 판정. 아니면 서버는 400 `SEARCH.QUERY_TOO_SHORT`                                                           |
| `SearchBox`                             | `role="search"` 로 묶은 `Input`(검색) + 제출 단추. 앞뒤 공백을 뗀 글자를 `onSearch` 로, 비어 있으면 아무 일도 없다                                                                        |
| `SearchResults`                         | 종류 칩 · 「결과 N개」(서버가 1,000번째에서 세기를 멈춘다) · 제목 링크 + 발췌 · `Pagination` · 빈 / 로딩 / 오류(다시 시도) · 「2글자 이상」 안내. 조건이 바뀌면 첫 쪽                     |
| `Highlight`                             | 서버의 `titleHighlights` · `snippetHighlights`(`[시작, 끝)` **UTF-16** 위치)를 `<mark>` 로. 문자열은 HTML 이 아니라 글자로만 그린다                                                       |

## 알아 둘 것

- **하이라이트 위치는 UTF-16** — JS 문자열 인덱스와 같다. 이모지(2칸) 앞의 일치도 어긋나지 않는다. 가장자리가 서로게이트 쌍이나 결합 문자 한가운데 떨어지면 글자 밖으로 넓혀 반으로 가르지 않는다(`splitHighlights`).
- **검색은 로그인한 사람만**(서버 `allow-anonymous-read` 기본 꺼짐) — 비로그인으로 열 서버라면 앱이 검색창을 보여 줄지 정한다.
- 한 글자는 서버에 묻지 않는다. 서버가 버리는 짧은 조각과 같은 판정이라 400 을 받지 않는다.
- 결과 창은 1,000번째까지(`400 SEARCH.PAGE_TOO_DEEP`) — 쪽 이동은 `totalElements`(1,000 에서 멈춤)까지만 나온다.
- 머리말 검색창의 이름은 같은 화면의 다른 검색칸(노트 목록의 거르기)과 겹치지 않게 앱이 `labels.box` 로 바꾼다(견본: 「전체 찾기」).

스토리: `Packages/search/SearchBox` · `SearchResults` · `useSearch`. 견본 조립: `apps/sample` 의 `HeaderSearch` · `SearchPage` · `search/describe.ts`.
