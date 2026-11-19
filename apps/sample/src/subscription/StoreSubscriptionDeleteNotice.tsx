import { storeOf, useMySubscription } from '@skeleton/payment'
import { Alert } from '@skeleton/ui'
import { languageOf, useT } from '../i18n'
import { subscriptionApi } from './api'
import { subscriptionLabelsFor } from './labels'

/**
 * 계정 삭제 줄에 붙는 경고 - 스토어(App Store · Google Play)가 과금하는 구독은 서버가 끝낼 수 없어 탈퇴해도 자동으로 해지되지 않는다.
 * 구독이 없거나 읽지 못하면(구독을 안 쓰는 서버) 아무것도 그리지 않는다
 */
export function StoreSubscriptionDeleteNotice() {
  const { t, locale } = useT()
  const me = useMySubscription(subscriptionApi)
  const subscription = me.data?.subscription
  // 끝났거나 이미 해지 예약된(`CANCELING`) 구독은 스토어에서 더 할 일이 없다
  if (
    !subscription ||
    subscription.status === 'ENDED' ||
    subscription.status === 'CANCELING' ||
    storeOf(subscription.provider) === null
  )
    return null
  const labels = subscriptionLabelsFor(t, languageOf(locale))
  return <Alert tone="warning">{labels.subscription.mine.storeManaged.beforeDelete}</Alert>
}
