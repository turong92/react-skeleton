import { usePaymentConfig } from '@skeleton/payment'
import { paymentApi } from '../cheer/api'
import { chooseProvider, FORCED_PROVIDER } from './provider'

/** 지금 구매자 나라로 결제할 결제사 id (서버가 켜진 결제사를 알려 주기 전에는 `undefined`) */
export function useChosenProvider(country: string): string | undefined {
  const config = usePaymentConfig(paymentApi)
  return chooseProvider({ providers: config.data?.providers, country, forced: FORCED_PROVIDER })
}
