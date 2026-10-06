import type { SignInIdentity } from '../account/types'
import type { AuthLabels } from './labels'

/** 떼도 되는가 — 서버가 계산한 `removable` 이 참이고, 화면에 보이는 수단이 하나뿐이 아닐 때(서버 값이 낡았어도 마지막 수단은 안 뗀다) */
export function canUnlink(identity: SignInIdentity, all: readonly SignInIdentity[]): boolean {
  return identity.removable && all.length > 1
}

/** 수단 코드 → 보이는 이름: 앱 문구 → 제공자 이름 → 코드 그대로 */
export function labelOfMethod(method: string, labels: AuthLabels): string {
  return labels.methodNames[method] ?? labels.providerNames[method] ?? method
}
