import { useProfileDialog } from '@skeleton/author-profile'
import { listQuery } from '@skeleton/author-profile'
import { boardKeys, type BoardConfig } from '@skeleton/board'
import { useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { PROFILE_BEFORE_WRITE } from '../auth/authConfig'
import { useT } from '../i18n'
import { profileApi } from './api'
import { authorProfileLabels } from './profileLabels'
import { mustCreateProfileFirst } from './profileGate'

export type ProfileGate = {
  /** 이름 있는 프로필이 하나도 없다 — 선택기는 목록 대신 「프로필 만들기」를 보인다 */
  mustCreate: boolean
  /** 쓰기 직전에 부른다 — 이름 있는 프로필이 없으면 대화상자를 열고 false(쓰던 글은 호출한 쪽이 그대로 둔다) */
  ensure: () => boolean
  /** 대화상자를 연다(선택기의 「프로필 만들기」) — 쓰던 글은 그대로 남는다 */
  open: (event?: { currentTarget: Element }) => void
  /** 폼 **밖**(페이지)에 그려 둔다 — 대화상자 안의 폼이 글쓰기 폼에 중첩되지 않게 */
  dialog: ReactNode
}

/**
 * 쓰기 전의 프로필 확인 — 서버가 작성자를 요구하는데 **이름 있는** 프로필이 하나도 없으면(0개이거나 이름 없는 첫 프로필뿐) 대화상자(프로필 관리)에서 만들거나 이름을 붙이게 한다.
 * 프로필 목록은 서버가 작성자를 요구할 때만 읽는다(요구하지 않는 백엔드에는 묻지 않는다). 대화상자와 포커스 복귀는 `useProfileDialog` 가 한다.
 */
export function useProfileGate(
  config: Pick<BoardConfig, 'authorRequired'> | undefined,
): ProfileGate {
  const { t } = useT()
  const required = PROFILE_BEFORE_WRITE && config?.authorRequired === true
  const profiles = useQuery({ ...listQuery(profileApi), enabled: required })
  const mustCreate = mustCreateProfileFirst({ authorRequired: required, profiles: profiles.data })
  const { open, dialog } = useProfileDialog({
    api: profileApi,
    labels: authorProfileLabels(t),
    title: t('profileGate.title'),
    description: <p>{t('profileGate.body')}</p>,
    closeLabel: t('common.close'),
    alsoInvalidate: [boardKeys.all],
  })
  return {
    mustCreate,
    ensure: () => {
      if (!mustCreate) return true
      open()
      return false
    },
    open,
    dialog,
  }
}
