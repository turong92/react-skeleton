import { Button, Field, Input, Select } from '@skeleton/ui'
import { useState } from 'react'
import type { PostListLabels } from './postListLabels'
import type { PostSort } from './types'
import styles from './PostList.module.css'

type Props = {
  sort: PostSort
  sorts: readonly PostSort[]
  query: string
  labels: PostListLabels
  onSortChange: (sort: PostSort) => void
  onSearch: (query: string) => void
}

/** 검색(Enter 로 확정) + 정렬 — 입력은 바로 보이고, 조건(주소)은 확정할 때만 바뀐다. `query` 가 바뀌면(검색 지우기) 입력도 맞춘다 */
export function PostListToolbar({ sort, sorts, query, labels, onSortChange, onSearch }: Props) {
  const [typed, setTyped] = useState(query)
  const [seen, setSeen] = useState(query)
  if (seen !== query) {
    setSeen(query)
    setTyped(query)
  }
  return (
    <form
      role="search"
      aria-label={labels.search}
      className={styles.toolbar}
      onSubmit={(event) => {
        event.preventDefault()
        onSearch(typed.trim())
      }}
    >
      <Field label={labels.search}>
        {(control) => (
          <Input
            {...control}
            type="search"
            placeholder={labels.searchPlaceholder}
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
          />
        )}
      </Field>
      <Field label={labels.sort}>
        {(control) => (
          <Select
            {...control}
            value={sort}
            onChange={(event) => onSortChange(event.target.value as PostSort)}
          >
            {sorts.map((value) => (
              <option key={value} value={value}>
                {labels.sorts[value]}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Button type="submit" variant="secondary">
        {labels.searchSubmit}
      </Button>
    </form>
  )
}
