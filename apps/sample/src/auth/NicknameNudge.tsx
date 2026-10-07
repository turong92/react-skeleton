import { listQuery } from '@skeleton/author-profile'
import { Button } from '@skeleton/ui'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { profileApi } from '../author/api'
import { mustCreateProfileFirst } from '../author/profileGate'
import { useT } from '../i18n'
import { NICKNAME_NUDGE } from './authConfig'
import { useNicknameGate } from './nicknameGateContext'
import styles from './NicknameNudge.module.css'

/**
 * 이름 없는 닉네임만 있는 로그인 사용자(링크 · 소셜 가입처럼 가입에서 닉네임을 받지 못한 길)에게 — 화면 위쪽의 눈에 띄는 띠(강조색 바탕 · 굵은 제목 · 채워진 주 버튼 하나).
 * 주 버튼 「닉네임 정하기」 는 그 자리의 대화상자(`NicknameGateProvider`)를 연다 — 글쓰기 전 확인과 같은 대화상자다. 계정 이름(나만 보는 이름)은 화면에 없다: 사용자에게는 닉네임 하나다.
 * 조건은 「닉네임 목록을 받았고 이름 있는 것이 하나도 없다」 — 모르는 동안(불러오는 중 · 실패)에는 띄우지 않는다. 닫을 수 있지만 저장하지 않고 이 화면 상태에만 두므로 다음 방문(새로고침 · 다시 로그인)에는 다시 보인다.
 * 색만으로 강조하지 않는다 — 제목 · 굵은 왼쪽 막대 · 버튼이 함께
 */
export function NicknameNudge() {
  const { t } = useT()
  const gate = useNicknameGate()
  const [dismissed, setDismissed] = useState(false)
  const profiles = useQuery({ ...listQuery(profileApi), enabled: NICKNAME_NUDGE })
  const needed = mustCreateProfileFirst({ authorRequired: true, profiles: profiles.data })
  if (!NICKNAME_NUDGE || dismissed || !needed) return null
  return (
    <section className={styles.band} aria-label={t('nickname.bannerLabel')}>
      <div className={styles.text}>
        <strong className={styles.title}>{t('nickname.bannerTitle')}</strong>
        <span>{t('nickname.bannerBody')}</span>
      </div>
      <div className={styles.actions}>
        <Button onClick={gate.open}>{t('nickname.nudgeAction')}</Button>
        <Button variant="ghost" onClick={() => setDismissed(true)}>
          {t('nickname.later')}
        </Button>
      </div>
    </section>
  )
}
