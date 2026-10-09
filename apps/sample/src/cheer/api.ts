import { createPaymentLedgerApi } from '@skeleton/payment'
import { apiClient } from '../api/client'
import { createCheerApi } from './cheerApi'

/** 결제 장부 — 경로는 백엔드 `modules/payment-jdbc` 가 여는 `/api/v1/payments` 가 기본값 */
export const paymentApi = createPaymentLedgerApi(apiClient)

/** 응원하기 — 백엔드 `apps/sample` 의 `/api/v1/cheers` */
export const cheerApi = createCheerApi(apiClient)
