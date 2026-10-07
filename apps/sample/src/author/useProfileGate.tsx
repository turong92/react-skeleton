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

/**
 * 쓰기 직전의 확인 — 서버가 작성자를 요구하는데 쓸 수 있는 프로필이 하나도 없으면 대화상자(프로필 관리)를 열고 false.
 * 쓰던 글은 호출한 쪽이 그대로 둔다. `dialog` 를 화면 어딘가에 그려 둔다. 프로필 목록은 서버가 작성자를 요구할 때만 읽는다(요구하지 않는 백엔드에는 묻지 않는다).
 */
export function useProfileGate(config: Pick<BoardConfig, 'authorRequired'> | undefined): {
  ensure: () => boolean
  dialog: ReactNode
} {
  const { t } = useT()
  const required = PROFILE_BEFORE_WRITE && config?.authorRequired === true
  const profiles = useQuery({ ...listQuery(profileApi), enabled: required })
  const [opened, setOpened] = useState(false)
  return {
    ensure: () => {
      if (!mustCreateProfileFirst({ authorRequired: required, profiles: profiles.data }))
        return true
      setOpened(true)
      return false
    },
    dialog: (
      <Dialog
        open={opened}
        onClose={() => setOpened(false)}
        title={t('profileGate.title')}
        closeLabel={t('common.close')}
      >
        <p>{t('profileGate.body')}</p>
        <AuthorProfileManager
          api={profileApi}
          labels={authorProfileLabels(t)}
          alsoInvalidate={[boardKeys.all]}
        />
      </Dialog>
    ),
  }
}
