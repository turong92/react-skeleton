import { ErrorCodes, isErrorCode } from '@skeleton/api-client'
import { Alert, Button, Field, Input } from '@skeleton/ui'
import { useState, type FormEvent } from 'react'
import { defaultRewardsLabels, type RewardsLabels } from '../labels'
import type { Coupon } from '../types'
import type { CouponApi } from './couponApi'
import { useRedeemCoupon } from './queries'
import styles from './RedeemCodeForm.module.css'

export type RedeemCodeFormProps = {
  api: Pick<CouponApi, 'redeemCoupon'>
  labels?: RewardsLabels
  onRedeemed?: (coupon: Coupon) => void
}

/** 쿠폰 코드 등록 — 코드 칸 + 「쿠폰 등록」. 맞지 않는 · 이미 쓴 · 소진된 코드는 칸 아래에 이유를 보인다 */
export function RedeemCodeForm({
  api,
  labels = defaultRewardsLabels,
  onRedeemed,
}: RedeemCodeFormProps) {
  const t = labels.coupon.redeem
  const [code, setCode] = useState('')
  const [done, setDone] = useState(false)
  const redeem = useRedeemCoupon(api)

  const error = (() => {
    if (!redeem.isError) return undefined
    if (isErrorCode(redeem.error, ErrorCodes.COUPON_CODE_INVALID)) return t.errors.invalid
    if (isErrorCode(redeem.error, ErrorCodes.COUPON_CODE_USED)) return t.errors.used
    if (isErrorCode(redeem.error, ErrorCodes.COUPON_CODE_EXHAUSTED)) return t.errors.exhausted
    if (isErrorCode(redeem.error, ErrorCodes.COUPON_ISSUE_CLOSED)) return t.errors.closed
    return t.errors.other
  })()

  function submit(event: FormEvent) {
    event.preventDefault()
    const trimmed = code.trim()
    if (!trimmed) return
    setDone(false)
    redeem.mutate(trimmed, {
      onSuccess: (coupon) => {
        setCode('')
        setDone(true)
        onRedeemed?.(coupon)
      },
    })
  }

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <Field label={t.label} hint={t.hint} error={error}>
        {(control) => (
          <Input
            {...control}
            value={code}
            autoComplete="off"
            autoCapitalize="characters"
            onChange={(event) => {
              setCode(event.target.value)
              setDone(false)
            }}
          />
        )}
      </Field>
      <Button
        type="submit"
        loading={redeem.isPending}
        loadingLabel={labels.loading}
        disabled={!code.trim()}
      >
        {t.submit}
      </Button>
      {done && <Alert tone="success">{t.success}</Alert>}
    </form>
  )
}
