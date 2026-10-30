import type { ApiKeyStatus } from './types'

/**
 * `ApiKeysSection` 의 문구. 부품은 i18n 을 모르고 기본은 영어, 앱이 언어에 맞는 것(`koApiKeysLabels`)을 넘긴다 - 일부만 덮어써도 된다.
 * 다시 인증 입력의 문구는 `AuthLabels`(`authLabels` prop)가 맡는다
 */
export type ApiKeysLabels = {
  title: string
  description: string
  create: string
  loading: string
  loadFailed: string
  retry: string
  empty: string
  cancel: string
  close: string
  status: Record<ApiKeyStatus, string>
  /** 운영자가 회수한 키 - 사유는 주인에게 보이지 않는다 */
  revokedByOperator: string
  revokedByYou: string
  hint: (hint: string) => string
  scopesLine: (scopes: string) => string
  noScopes: string
  createdOn: (date: string) => string
  expiresOn: (date: string) => string
  neverExpires: string
  lastUsed: (date: string) => string
  neverUsed: string
  revoke: string
  /** 줄의 단추 낭독 이름(어느 키인지) */
  revokeFor: (name: string) => string
  createTitle: string
  nameLabel: string
  nameHint: string
  scopesLegend: string
  scopesEmpty: string
  scopesNeeded: string
  expiryLabel: string
  expiryChoice: (days: number) => string
  expiryNone: string
  reauthHint: string
  /** 비밀번호도 이메일도 없는 계정(제공자 다시 인증만 가능) - 이 화면은 그 왕복을 받지 않는다 */
  providerReauthUnsupported: string
  submit: string
  tokenTitle: string
  tokenWarning: string
  tokenLabel: string
  tokenOnce: string
  copy: string
  copied: string
  copyFailed: string
  tokenDone: string
  revokeTitle: (name: string) => string
  revokeBody: string
  revokeConfirm: string
  errors: {
    limitReached: string
    scopeUnknown: string
    expiresInvalid: string
    notFound: string
    notEnabled: string
    generic: string
  }
}

export const defaultApiKeysLabels: ApiKeysLabels = {
  title: 'API keys',
  description:
    'Keys let a program use your account within the scopes you pick. Revoke one to cut it off at once.',
  create: 'Create a key',
  loading: 'Loading',
  loadFailed: 'Could not load your API keys.',
  retry: 'Try again',
  empty: 'You have no API keys yet.',
  cancel: 'Cancel',
  close: 'Close',
  status: { ACTIVE: 'Active', EXPIRED: 'Expired', REVOKED: 'Revoked' },
  revokedByOperator: 'Revoked by an operator',
  revokedByYou: 'Revoked by you',
  hint: (hint) => `Ends with ${hint}`,
  scopesLine: (scopes) => `Scopes: ${scopes}`,
  noScopes: 'No scopes',
  createdOn: (date) => `Created ${date}`,
  expiresOn: (date) => `Expires ${date}`,
  neverExpires: 'Never expires',
  lastUsed: (date) => `Last used ${date}`,
  neverUsed: 'Never used',
  revoke: 'Revoke',
  revokeFor: (name) => `Revoke ${name}`,
  createTitle: 'Create an API key',
  nameLabel: 'Name',
  nameHint: 'What it is for, for example "CI server".',
  scopesLegend: 'What the key may do',
  scopesEmpty: 'This app has not declared any scopes, so keys cannot be created.',
  scopesNeeded: 'Pick at least one.',
  expiryLabel: 'Expires',
  expiryChoice: (days) => `After ${days} days`,
  expiryNone: 'Never',
  reauthHint: 'Confirm it is you before a key is created.',
  providerReauthUnsupported:
    'Your account has no password or email yet. Add one in your account settings, then come back to create a key.',
  submit: 'Create key',
  tokenTitle: 'Your new API key',
  tokenWarning:
    'Copy it now and keep it somewhere safe. Anyone who has it can act within its scopes.',
  tokenLabel: 'API key',
  tokenOnce: 'You will not be able to see this key again.',
  copy: 'Copy',
  copied: 'Copied',
  copyFailed: 'Copy failed',
  tokenDone: 'I copied it',
  revokeTitle: (name) => `Revoke ${name}?`,
  revokeBody: 'Programs using this key stop working at once. This cannot be undone.',
  revokeConfirm: 'Revoke',
  errors: {
    limitReached: 'You have reached the limit of active keys. Revoke one you no longer use.',
    scopeUnknown: 'One of the scopes is not known to this server. Reload and try again.',
    expiresInvalid: 'That expiry is beyond what this app allows. Pick a shorter one.',
    notFound: 'This key no longer exists. The list was refreshed.',
    notEnabled: 'API keys are not turned on for this server.',
    generic: 'Something went wrong. Try again.',
  },
}

export const koApiKeysLabels: Partial<ApiKeysLabels> = {
  title: 'API 키',
  description:
    '프로그램이 내 계정으로, 고른 범위 안에서만 일하게 하는 열쇠예요. 회수하면 바로 막혀요.',
  create: '키 만들기',
  loading: '불러오는 중',
  loadFailed: 'API 키를 불러오지 못했어요.',
  retry: '다시 시도',
  empty: '아직 만든 키가 없어요.',
  cancel: '취소',
  close: '닫기',
  status: { ACTIVE: '사용 중', EXPIRED: '만료', REVOKED: '회수됨' },
  revokedByOperator: '운영자가 회수',
  revokedByYou: '내가 회수',
  hint: (hint) => `끝 글자 ${hint}`,
  scopesLine: (scopes) => `범위: ${scopes}`,
  noScopes: '범위 없음',
  createdOn: (date) => `${date} 만듦`,
  expiresOn: (date) => `${date} 만료`,
  neverExpires: '만료 없음',
  lastUsed: (date) => `마지막 사용 ${date}`,
  neverUsed: '아직 안 썼어요',
  revoke: '회수',
  revokeFor: (name) => `${name} 회수`,
  createTitle: 'API 키 만들기',
  nameLabel: '이름',
  nameHint: '어디에 쓰는지, 예: "CI 서버"',
  scopesLegend: '키가 할 수 있는 일',
  scopesEmpty: '이 앱이 선언한 범위가 없어 키를 만들 수 없어요.',
  scopesNeeded: '하나 이상 골라 주세요.',
  expiryLabel: '만료',
  expiryChoice: (days) => `${days}일 뒤`,
  expiryNone: '없음',
  reauthHint: '키를 만들기 전에 본인인지 한 번 확인해요.',
  providerReauthUnsupported:
    '비밀번호나 이메일이 없는 계정이에요. 계정 설정에서 하나를 먼저 등록한 뒤 키를 만들어 주세요.',
  submit: '키 만들기',
  tokenTitle: '새 API 키',
  tokenWarning:
    '지금 복사해서 안전한 곳에 두세요. 이 키를 가진 사람은 범위 안에서 내 계정으로 일할 수 있어요.',
  tokenLabel: 'API 키',
  tokenOnce: '이 키는 다시 볼 수 없어요.',
  copy: '복사',
  copied: '복사됨',
  copyFailed: '복사하지 못했어요',
  tokenDone: '복사했어요',
  revokeTitle: (name) => `${name} 키를 회수할까요?`,
  revokeBody: '이 키를 쓰던 프로그램이 바로 멈춰요. 되돌릴 수 없어요.',
  revokeConfirm: '회수',
  errors: {
    limitReached: '사용 중인 키가 한도에 닿았어요. 안 쓰는 키를 회수해 주세요.',
    scopeUnknown: '서버가 모르는 범위가 있어요. 새로 고친 뒤 다시 해 주세요.',
    expiresInvalid: '이 앱이 허용하는 기간보다 길어요. 더 짧은 기간을 골라 주세요.',
    notFound: '이 키는 이미 없어요. 목록을 새로 고쳤어요.',
    notEnabled: '이 서버는 API 키를 켜지 않았어요.',
    generic: '문제가 생겼어요. 다시 시도해 주세요.',
  },
}

/** 기본 문구에 일부만 덮어쓴다(`errors` · `status` 같은 묶음도 한 칸만 바꿀 수 있다) */
export function mergeApiKeysLabels(given?: Partial<ApiKeysLabels>): ApiKeysLabels {
  if (!given) return defaultApiKeysLabels
  const out: Record<string, unknown> = { ...defaultApiKeysLabels }
  for (const [key, value] of Object.entries(given)) {
    const original = (defaultApiKeysLabels as Record<string, unknown>)[key]
    out[key] =
      typeof original === 'object' && original !== null && typeof value === 'object'
        ? { ...original, ...value }
        : value
  }
  return out as ApiKeysLabels
}
