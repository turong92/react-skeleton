import { Button } from '@skeleton/ui'
import { useState } from 'react'
import { useT } from '../i18n'
import { NICKNAME_NUDGE } from './authConfig'
import { useNicknameGate } from './nicknameGateContext'
import { needsNickname } from './profileDisplay'
import { useMyProfile } from './useMyProfile'
import styles from './NicknameNudge.module.css'

/**
 * 닉네임이 없는 로그인 사용자에게 — 화면 위쪽의 눈에 띄는 띠(강조색 바탕 · 굵은 제목 · 채워진 주 버튼). 버튼은 그 자리의 대화상자를 연다.
 * 닫을 수 있지만 저장하지 않고 이 화면 상태에만 두므로 다음 방문(새로고침 · 다시 로그인)에는 다시 보인다. 색만으로 강조하지 않는다 — 제목 · 굵은 왼쪽 막대 · 버튼이 함께
 */
export function NicknameNudge() {
  const { t } = useT()
  const me = useMyProfile()
  const gate = useNicknameGate()
  const [dismissed, setDismissed] = useState(false)
  if (!NICKNAME_NUDGE || dismissed || !needsNickname(me.data)) return null
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
