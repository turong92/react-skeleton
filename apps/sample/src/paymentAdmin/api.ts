import { createPaymentAdminApi } from '@skeleton/payment/admin'
import { apiClient } from '../api/client'

/** 운영자 결제 도구 — 백엔드 `skeleton.payment.admin.enabled=true`(이 앱은 켠다)와 ADMIN 역할이 필요하다. 경로는 `/api/v1/admin/payments` */
export const paymentAdminApi = createPaymentAdminApi(apiClient)
