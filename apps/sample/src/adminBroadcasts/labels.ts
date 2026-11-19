import { defaultBroadcastAdminLabels, koBroadcastAdminLabels } from '@skeleton/notifications/admin'
import type { MessageKey } from '../i18n'

export const broadcastLabelsFor = (language: 'ko' | 'en') =>
  language === 'ko' ? koBroadcastAdminLabels : defaultBroadcastAdminLabels

/** 서버 설정 `skeleton.notification.broadcast.types` 의 종류 코드 → 보이는 이름. 종류를 바꾸면 여기와 두 사전을 같이 고친다 */
export const BROADCAST_TYPES = ['notice.service', 'promo.notes-tips'] as const

export const broadcastTypeLabels = (t: (key: MessageKey) => string): Record<string, string> =>
  Object.fromEntries(
    BROADCAST_TYPES.map((type) => [type, t(`broadcast.type.${type}` as MessageKey)]),
  )
