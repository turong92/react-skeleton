import { usePaymentConfig } from '@skeleton/payment'
import { paymentApi } from '../cheer/api'

/** 서버가 이 요청의 나라로 정한 결제사 id - 화면이 고르지 않는다(서버가 아직 안 답했거나 정하지 못했으면 `undefined`) */
export function useServerProvider(): string | undefined {
  return usePaymentConfig(paymentApi).data?.provider ?? undefined
}
