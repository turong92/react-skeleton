import { AuthorProfileManager, listQuery } from '@skeleton/author-profile'
import { boardKeys, type BoardConfig } from '@skeleton/board'
import { Dialog } from '@skeleton/ui'
import { useQuery } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
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
  open: () => void
  /** 화면 어딘가에 그려 둔다 */
  dialog: ReactNode
}

/**
 * 쓰기 전의 프로필 확인 — 서버가 작성자를 요구하는데 **이름 있는** 프로필이 하나도 없으면(0개이거나 자동으로 만들어진 이름 없는 첫 프로필뿐) 대화상자(프로필 관리)에서 만들거나 이름을 붙이게 한다.
 * 프로필 목록은 서버가 작성자를 요구할 때만 읽는다(요구하지 않는 백엔드에는 묻지 않는다). 관리자는 대화상자가 열렸을 때만 마운트한다(닫힌 `Dialog` 도 자식을 그린다).
 */
export function useProfileGate(
  config: Pick<BoardConfig, 'authorRequired'> | undefined,
): ProfileGate {
  const { t } = useT()
  const required = PROFILE_BEFORE_WRITE && config?.authorRequired === true
  const profiles = useQuery({ ...listQuery(profileApi), enabled: required })
  const [opened, setOpened] = useState(false)
  const mustCreate = mustCreateProfileFirst({ authorRequired: required, profiles: profiles.data })
  return {
    mustCreate,
    ensure: () => {
      if (!mustCreate) return true
      setOpened(true)
      return false
    },
    open: () => setOpened(true),
    dialog: (
      <Dialog
        open={opened}
        onClose={() => setOpened(false)}
        title={t('profileGate.title')}
        closeLabel={t('common.close')}
      >
        {opened && (
          <>
            <p>{t('profileGate.body')}</p>
            <AuthorProfileManager
              api={profileApi}
              labels={authorProfileLabels(t)}
              alsoInvalidate={[boardKeys.all]}
            />
          </>
        )}
      </Dialog>
    ),
  }
}
