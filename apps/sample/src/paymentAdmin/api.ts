import { createPaymentAdminApi } from '@skeleton/payment/admin'
import { apiClient } from '../api/client'

/** 운영자 결제 도구 — 백엔드 `skeleton.payment.admin.enabled=true`(이 앱은 켠다)와 `payment.read` 권한이 필요하다(환불은 `payment.refund`, 맞추기 · 닫기는 `payment.operate`). 경로는 `/api/v1/admin/payments` */
export const paymentAdminApi = createPaymentAdminApi(apiClient)
