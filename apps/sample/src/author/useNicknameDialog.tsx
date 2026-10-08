import { defaultAuthLabels, useEmailBeforeWrite } from '@skeleton/auth'
import { useProfileDialog } from '@skeleton/author-profile'
import { boardKeys } from '@skeleton/board'
import { useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { emailRequired } from '../api/emailRequired'
import { ACCOUNT_PATH, DECLINED_TOAST_ID, onAccountPages } from '../auth/accountPath'
import { useAuthLabels } from '../auth/useAuthLabels'
import { useT } from '../i18n'
import { profileApi } from './api'
import { authorProfileLabels } from './profileLabels'

/**
 * 「닉네임을 정해 주세요」 대화상자 — 안내 띠의 단추와 글쓰기 전 확인(선택기의 「닉네임 정하기」 포함)이 **같은 대화상자**를 연다(문구 · 동작이 하나).
 * 안은 닉네임 관리(목록 · 이름 바꾸기 · 추가)다 — 이름 없는 첫 닉네임에 「바꾸기」로 이름을 붙이거나 새로 추가한다. 쓰던 글은 폼에 그대로 남는다.
 *
 * **열기 전에 이메일부터** 받는다(`useEmailBeforeWrite`, 스펙 9.5 의 이메일 → 닉네임 순서) - 이 대화상자 안의 저장은 쓰기(`PATCH /author-profiles/{id}` · `POST /author-profiles`)라
 * 쓰기 때 방식의 서버가 주소 없는 계정에게 403 을 준다. 네이티브 모달(`<dialog>`)이 열려 있으면 그 밖의 이메일 화면은 브라우저가 `inert` 로 만들어 모달 **밑**에 깔려 눌리지 않는다 -
 * 그래서 모달 안에서 막힐 쓰기는 모달을 열기 전에 `ensure()` 로 미리 풀어 둔다. 이메일 화면이 열렸으면 대화상자는 열리지 않고, 사용자가 등록한 뒤 다시 누른다
 */
export function useNicknameDialog() {
  const { t } = useT()
  const { ensure: ensureEmail } = useEmailBeforeWrite(emailRequired)
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const labels = useAuthLabels()
  const { open: openDialog, dialog } = useProfileDialog({
    api: profileApi,
    labels: authorProfileLabels(t),
    title: t('nickname.dialogTitle'),
    description: <p>{t('nickname.dialogBody')}</p>,
    closeLabel: t('common.close'),
    alsoInvalidate: [boardKeys.all],
  })
  const open = useCallback(
    (event?: { currentTarget: Element }) => {
      if (ensureEmail()) return openDialog(event)
      // 계정 설정(`/account`)은 이메일 막이 걷혀 있어 `ensure()` 가 화면을 열지 못한다 - 말없이 끝나지 않게 이유 한 줄과 같은 화면의 이메일 구역으로 데려간다
      if (onAccountPages(pathname)) {
        toast.info(labels.emailRequiredDeclined ?? defaultAuthLabels.emailRequiredDeclined, {
          id: DECLINED_TOAST_ID,
        })
        void navigate(`${ACCOUNT_PATH}#email`)
        document.getElementById('email')?.scrollIntoView({ block: 'start' }) // 이미 그 해시면 주소가 바뀌지 않아 구역 이동이 따로 일어나지 않는다
      }
    },
    [ensureEmail, openDialog, pathname, navigate, labels],
  )
  return { open, dialog }
}
