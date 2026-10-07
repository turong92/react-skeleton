import { Button } from '@skeleton/ui'
import type { AuthorProfileApi } from './authorProfileApi'
import { useAuthorProfiles } from './hooks'
import {
  AuthorPickerView,
  type AuthorPickerSlotProps,
  type AuthorPickerViewProps,
} from './AuthorPickerView'
import { mergeLabels } from './labels'

export { AuthorPickerView }
export type { AuthorPickerSlotProps, AuthorPickerViewProps }

export type AuthorPickerProps = AuthorPickerSlotProps &
  Omit<AuthorPickerViewProps, 'profiles' | keyof AuthorPickerSlotProps> & {
    api: AuthorProfileApi
  }

/**
 * 게시판의 `authorPicker` 에 꽂는 선택기 — 목록은 `useAuthorProfiles(api)` 로 가져온다.
 * `authorPicker={(args) => <AuthorPicker {...args} api={api} boardCode={code} memory={memory} />}`
 */
export function AuthorPicker({ api, ...rest }: AuthorPickerProps) {
  const labels = mergeLabels(rest.labels)
  const list = useAuthorProfiles(api)
  if (list.data) return <AuthorPickerView {...rest} profiles={list.data} />
  if (list.isError)
    return (
      <Button
        variant="secondary"
        disabled={rest.disabled}
        aria-describedby={rest['aria-describedby']}
        onClick={() => void list.refetch()}
      >
        {labels.loadFailed}
      </Button>
    )
  return (
    <Button variant="secondary" loading loadingLabel="" aria-describedby={rest['aria-describedby']}>
      {labels.loading}
    </Button>
  )
}
