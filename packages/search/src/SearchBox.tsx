import { Button, Input } from '@skeleton/ui'
import { useState, type FormEvent } from 'react'
import { defaultSearchLabels, type SearchLabels } from './labels'
import styles from './SearchBox.module.css'

export type SearchBoxProps = {
  labels?: SearchLabels
  /** 처음에 채워 둘 글자 - 바뀐 값을 다시 채우려면 앱이 `key` 를 바꾼다 */
  defaultValue?: string
  /** 제출(Enter · 단추) - 앞뒤 공백을 뗀 글자. 비어 있으면 부르지 않는다 */
  onSearch: (query: string) => void
  className?: string
}

/** 검색 입력 - `role="search"` 로 묶은 `Input`(검색) + 제출 단추. 이동은 앱의 몫이다 */
export function SearchBox({
  labels = defaultSearchLabels,
  defaultValue = '',
  onSearch,
  className,
}: SearchBoxProps) {
  const t = labels.box
  const [value, setValue] = useState(defaultValue)

  function submit(event: FormEvent) {
    event.preventDefault()
    const query = value.trim()
    if (query) onSearch(query)
  }

  return (
    <form
      role="search"
      aria-label={t.label}
      onSubmit={submit}
      className={[styles.form, className].filter(Boolean).join(' ')}
    >
      <Input
        type="search"
        aria-label={t.label}
        placeholder={t.placeholder}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        className={styles.input}
      />
      <Button type="submit" variant="secondary" size="sm">
        {t.submit}
      </Button>
    </form>
  )
}
