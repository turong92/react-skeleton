import ko from '../i18n/ko'
import type { MessageKey } from '../i18n'

/** 플랜 이름 - 이 앱의 사전에 플랜 코드로 된 번역(`subscription.plan.<코드>`)이 있으면 그것을, 없으면 서버가 준 이름을 쓴다 */
export function planNameOf(
  t: (key: MessageKey) => string,
  plan: { code: string; name: string },
): string {
  const key = `subscription.plan.${plan.code}`
  return Object.hasOwn(ko, key) ? t(key as MessageKey) : plan.name
}
