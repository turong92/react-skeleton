import type { PaymentLabels, PaymentLabelsInput } from './labelTypes'
import { defaultPaymentLabels } from './labels.en'

export type {
  DeclineCategory,
  PaymentLabels,
  PaymentLabelsInput,
  RefundReasonCode,
  SubscriptionLabels,
} from './labelTypes'
export { defaultPaymentLabels } from './labels.en'
export { koPaymentLabels } from './labels.ko'

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

function merge<T>(base: T, over: unknown): T {
  if (!isPlainObject(base) || !isPlainObject(over)) return (over === undefined ? base : over) as T
  const out: Record<string, unknown> = { ...base }
  for (const [key, value] of Object.entries(over))
    if (value !== undefined) out[key] = merge(base[key], value)
  return out as T
}

/** 앱이 준 일부 문구를 기본 문구 위에 덮는다(안쪽도 일부만 가능) */
export function resolvePaymentLabels(input: PaymentLabelsInput = {}): PaymentLabels {
  return merge(defaultPaymentLabels, input)
}
