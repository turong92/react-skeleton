import type { QueryKey } from '@tanstack/react-query'
import { Dialog } from '@skeleton/ui'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { AuthorProfileApi } from './authorProfileApi'
import { AuthorProfileManager } from './AuthorProfileManager'
import type { AuthorProfileLabels } from './labels'

/** `@skeleton/board` 폼의 선택기 자리(`data-author-slot`) 안의 첫 조작 요소 — board 의 `focusAuthorSlot` 과 같은 선택자 */
const SLOT_CONTROL =
  '[data-author-slot] :is(button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])):not(:disabled)'

export type UseProfileDialogOptions = {
  api: AuthorProfileApi
  labels?: Partial<AuthorProfileLabels>
  title: string
  /** 관리 화면 위의 한 줄 안내 */
  description?: ReactNode
  closeLabel?: string
  alsoInvalidate?: readonly QueryKey[]
}

/**
 * 프로필 관리를 **대화상자**로 연다 — 폼 안의 선택기 「프로필 만들기」가 부른다(`<AuthorPickerView onCreateProfile={open} …/>`). 쓰던 글은 폼에 그대로 남는다.
 * 관리 화면은 열렸을 때만 마운트한다(닫힌 `Dialog` 도 자식을 그린다).
 * 포커스: 닫으면 연 단추로 돌아간다. 그런데 프로필을 만들고 나면 선택기가 다른 모양으로 바뀌어 그 단추가 사라진다 —
 * 연 단추가 문서에 없으면 그 폼의 선택기 자리(`[data-author-slot]`)의 첫 조작 요소로 보낸다(body 로 떨어지지 않게).
 */
export function useProfileDialog({
  api,
  labels,
  title,
  description,
  closeLabel,
  alsoInvalidate,
}: UseProfileDialogOptions): { open: () => void; dialog: ReactNode } {
  const [opened, setOpened] = useState(false)
  const origin = useRef<{ opener: Element | null; form: Element | null }>({
    opener: null,
    form: null,
  })
  const wasOpened = useRef(false)

  function open() {
    const active = document.activeElement
    origin.current = { opener: active, form: active?.closest('form') ?? null }
    setOpened(true)
  }

  // 닫힌 뒤(아래 `Dialog` 의 효과가 먼저 창을 닫는다) — 연 단추가 사라졌다면 선택기 자리로
  useEffect(() => {
    if (opened) {
      wasOpened.current = true
      return
    }
    if (!wasOpened.current) return
    wasOpened.current = false
    const { opener, form } = origin.current
    if (opener?.isConnected || !form?.isConnected) return
    form.querySelector<HTMLElement>(SLOT_CONTROL)?.focus()
  }, [opened])

  return {
    open,
    dialog: (
      <Dialog open={opened} onClose={() => setOpened(false)} title={title} closeLabel={closeLabel}>
        {opened && (
          <>
            {description}
            <AuthorProfileManager api={api} labels={labels} alsoInvalidate={alsoInvalidate} />
          </>
        )}
      </Dialog>
    ),
  }
}
