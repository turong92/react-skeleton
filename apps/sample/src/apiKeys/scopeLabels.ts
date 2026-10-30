import type { MessageKey } from '../i18n'

/** 노트 API 가 선언한 키 범위(백엔드 `NoteApiKeyScopes`) - 화면에 보일 이름. 선언되지 않은 범위는 키 그대로 보인다 */
export const noteScopeLabels = (t: (key: MessageKey) => string): Record<string, string> => ({
  'notes.read': t('apiKeys.scope.notesRead'),
  'notes.write': t('apiKeys.scope.notesWrite'),
})

/** 키 수명 상한(일) - 백엔드 `skeleton.api-key.max-lifetime: 365d` 와 같다 */
export const API_KEY_MAX_LIFETIME_DAYS = 365
