import { formatInstant } from '@skeleton/time'
import { Alert, Button, Field, Input } from '@skeleton/ui'
import { useState, type FormEvent } from 'react'
import { defaultRewardsLabels, type RewardsLabels } from '../labels'
import type { CampaignApi } from './campaignApi'
import { useClaimReferral, useReferral } from './queries'
import { referralRejection } from './rejection'
import styles from './ReferralCodeForm.module.css'

export type ReferralCodeFormProps = {
  api: Pick<CampaignApi, 'myReferral' | 'claimReferral'>
  labels?: RewardsLabels
  locale?: string
  formatTime?: (iso: string) => string
  /** 코드가 받아들여진 뒤 */
  onClaimed?: () => void
}

/**
 * 초대 코드 직접 입력 — 링크 없이 가입한 사람이 가입 뒤에 코드를 넣는다. `GET /referrals/me` 의 `canClaim` 일 때만 그린다.
 * 거절 이유(`data.reason`)별 문구를 칸 아래에 보이고, 성공하면 안내 한 줄(그 뒤 서버가 `canClaim` 을 끈다).
 */
export function ReferralCodeForm({
  api,
  labels = defaultRewardsLabels,
  locale,
  formatTime = (iso) => formatInstant(iso, { locale }),
  onClaimed,
}: ReferralCodeFormProps) {
  const t = labels.invite.claim
  const [code, setCode] = useState('')
  const [done, setDone] = useState(false)
  const me = useReferral(api)
  const claim = useClaimReferral(api)

  if (!me.data?.canClaim && !done) return null
  if (done) return <Alert tone="success">{t.success}</Alert>

  const until = me.data?.claimUntil
  const hint = until ? `${t.hint} ${t.until(formatTime(until))}` : t.hint
  const error = claim.isError ? t.errors[referralRejection(claim.error)] : undefined

  function submit(event: FormEvent) {
    event.preventDefault()
    const trimmed = code.trim()
    if (!trimmed) return
    claim.mutate(trimmed, {
      onSuccess: () => {
        setCode('')
        setDone(true)
        onClaimed?.()
      },
    })
  }

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <Field label={t.label} hint={hint} error={error}>
        {(control) => (
          <Input
            {...control}
            value={code}
            autoComplete="off"
            autoCapitalize="characters"
            onChange={(event) => setCode(event.target.value)}
          />
        )}
      </Field>
      <Button
        type="submit"
        loading={claim.isPending}
        loadingLabel={labels.loading}
        disabled={!code.trim()}
      >
        {t.submit}
      </Button>
    </form>
  )
}
