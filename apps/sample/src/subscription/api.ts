import { createSubscriptionApi } from '@skeleton/payment'
import { apiClient } from '../api/client'

/** 구독 — 경로는 백엔드 `skeleton.payment.subscription.enabled=true` 가 여는 `/api/v1/payments/subscriptions` */
export const subscriptionApi = createSubscriptionApi(apiClient)
