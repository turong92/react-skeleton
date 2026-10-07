import { useProfileDialog } from '@skeleton/author-profile'
import { boardKeys } from '@skeleton/board'
import { useT } from '../i18n'
import { profileApi } from './api'
import { authorProfileLabels } from './profileLabels'

/**
 * 「닉네임을 정해 주세요」 대화상자 — 안내 띠의 단추와 글쓰기 전 확인이 **같은 대화상자**를 연다(문구 · 동작이 하나).
 * 안은 닉네임 관리(목록 · 이름 바꾸기 · 추가)다 — 이름 없는 첫 닉네임에 「바꾸기」로 이름을 붙이거나 새로 추가한다. 쓰던 글은 폼에 그대로 남는다
 */
export function useNicknameDialog() {
  const { t } = useT()
  return useProfileDialog({
    api: profileApi,
    labels: authorProfileLabels(t),
    title: t('nickname.dialogTitle'),
    description: <p>{t('nickname.dialogBody')}</p>,
    closeLabel: t('common.close'),
    alsoInvalidate: [boardKeys.all],
  })
}
