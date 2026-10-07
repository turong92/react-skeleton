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
  // 불러오는 중 — 꺼진(disabled) 단추가 아니라 포커스를 받는 aria-disabled 단추(눌러도 아무 일 없고, 오류 설명은 읽힌다)
  return (
    <Button
      variant="secondary"
      aria-disabled="true"
      aria-busy="true"
      aria-describedby={rest['aria-describedby']}
    >
      {labels.loading}
    </Button>
  )
}
