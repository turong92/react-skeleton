import { SearchBox } from '@skeleton/search'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { languageOf, useT } from '../i18n'
import { searchLabelsFor } from '../search/labels'
import { searchPath } from '../search/searchQuery'
import styles from './HeaderSearch.module.css'

/** 머리말 검색창 - 제출하면 `/search?q=` 로 간다. 검색 화면에서는 찾은 글자가 채워져 있고 주소가 바뀌면 따라 바뀐다 */
export function HeaderSearch() {
  const { locale } = useT()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [params] = useSearchParams()
  const current = pathname === '/search' ? (params.get('q') ?? '') : ''
  return (
    <SearchBox
      key={current}
      defaultValue={current}
      labels={searchLabelsFor(languageOf(locale))}
      onSearch={(query) => navigate(searchPath(query))}
      className={styles.box}
    />
  )
}
