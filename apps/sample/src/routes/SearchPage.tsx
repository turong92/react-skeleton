import { SearchResults } from '@skeleton/search'
import { PageHeader } from '@skeleton/ui'
import { Link, useSearchParams } from 'react-router-dom'
import { languageOf, useT } from '../i18n'
import { searchApi } from '../search/api'
import { describeSearchType, SEARCH_TYPES } from '../search/describe'
import { searchLabelsFor } from '../search/labels'

/** 검색 결과 화면 `/search?q=` - 검색창은 머리말에 있다(`HeaderSearch`). 노트는 `/notes/:id`, 상품은 `/products/:code` 로 잇는다 */
export function SearchPage() {
  const { t, locale } = useT()
  const [params] = useSearchParams()
  const query = params.get('q') ?? ''
  return (
    <>
      <PageHeader title={t('search.title')} description={t('search.subtitle')} />
      <SearchResults
        api={searchApi}
        query={query}
        types={[...SEARCH_TYPES]}
        describe={(type) => describeSearchType(t, type)}
        labels={searchLabelsFor(languageOf(locale))}
        renderLink={(href, children) => <Link to={href}>{children}</Link>}
      />
    </>
  )
}
