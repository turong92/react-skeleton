import type { ApiKeyStatus } from '../apiKeys/types'

/** `AdminApiKeys` 의 문구. 기본은 영어, 앱이 `koAdminApiKeysLabels` 를 넘긴다 - 일부만 덮어써도 된다 */
export type AdminApiKeysLabels = {
  title: string
  caption: string
  loading: string
  loadFailed: string
  retry: string
  empty: string
  noAccess: string
  notEnabled: string
  more: string
  cancel: string
  close: string
  filterOwner: string
  filterOwnerHint: string
  filterStatus: string
  allStatuses: string
  apply: string
  status: Record<ApiKeyStatus, string>
  revokedByOperator: string
  revokedByUser: string
  revokedReason: (reason: string) => string
  neverExpires: string
  neverUsed: string
  columns: {
    name: string
    owner: string
    scopes: string
    status: string
    expires: string
    lastUsed: string
    actions: string
  }
  revoke: string
  revokeFor: (name: string, owner: string) => string
  revokeTitle: string
  revokeReason: string
  revokeReasonHint: string
  revokeConfirm: string
  errors: { notFound: string; generic: string }
}

export const defaultAdminApiKeysLabels: AdminApiKeysLabels = {
  title: 'API keys',
  caption: 'API keys of all accounts',
  loading: 'Loading',
  loadFailed: 'Could not load the API keys.',
  retry: 'Try again',
  empty: 'No API keys match.',
  noAccess: 'You do not have permission to view API keys.',
  notEnabled: 'The API key admin tool is not turned on for this server.',
  more: 'Show more',
  cancel: 'Cancel',
  close: 'Close',
  filterOwner: 'Owner account id',
  filterOwnerHint: 'Leave empty to see every account.',
  filterStatus: 'Status',
  allStatuses: 'All',
  apply: 'Filter',
  status: { ACTIVE: 'Active', EXPIRED: 'Expired', REVOKED: 'Revoked' },
  revokedByOperator: 'Revoked by an operator',
  revokedByUser: 'Revoked by the owner',
  revokedReason: (reason) => `Reason: ${reason}`,
  neverExpires: 'Never',
  neverUsed: 'Never',
  columns: {
    name: 'Name',
    owner: 'Owner',
    scopes: 'Scopes',
    status: 'Status',
    expires: 'Expires',
    lastUsed: 'Last used',
    actions: 'Actions',
  },
  revoke: 'Revoke',
  revokeFor: (name, owner) => `Revoke ${name} (${owner})`,
  revokeTitle: 'Revoke API key',
  revokeReason: 'Reason',
  revokeReasonHint:
    'Recorded in the operator audit log. The owner only sees "revoked by an operator".',
  revokeConfirm: 'Revoke',
  errors: {
    notFound: 'This key no longer exists. The list was refreshed.',
    generic: 'Something went wrong. Try again.',
  },
}

export const koAdminApiKeysLabels: Partial<AdminApiKeysLabels> = {
  title: 'API 키',
  caption: '모든 계정의 API 키',
  loading: '불러오는 중',
  loadFailed: 'API 키를 불러오지 못했어요.',
  retry: '다시 시도',
  empty: '조건에 맞는 키가 없어요.',
  noAccess: 'API 키를 볼 권한이 없어요.',
  notEnabled: '이 서버는 API 키 운영 도구를 켜지 않았어요.',
  more: '더 보기',
  cancel: '취소',
  close: '닫기',
  filterOwner: '주인 계정 id',
  filterOwnerHint: '비워 두면 모든 계정이에요.',
  filterStatus: '상태',
  allStatuses: '전체',
  apply: '걸러 보기',
  status: { ACTIVE: '사용 중', EXPIRED: '만료', REVOKED: '회수됨' },
  revokedByOperator: '운영자가 회수',
  revokedByUser: '주인이 회수',
  revokedReason: (reason) => `사유: ${reason}`,
  neverExpires: '없음',
  neverUsed: '없음',
  columns: {
    name: '이름',
    owner: '주인',
    scopes: '범위',
    status: '상태',
    expires: '만료',
    lastUsed: '마지막 사용',
    actions: '동작',
  },
  revoke: '회수',
  revokeFor: (name, owner) => `${name}(${owner}) 회수`,
  revokeTitle: 'API 키 회수',
  revokeReason: '사유',
  revokeReasonHint: '운영 기록에 남아요. 주인에게는 「운영자가 회수」만 보여요.',
  revokeConfirm: '회수',
  errors: {
    notFound: '이 키는 이미 없어요. 목록을 새로 고쳤어요.',
    generic: '문제가 생겼어요. 다시 시도해 주세요.',
  },
}

export function mergeAdminApiKeysLabels(given?: Partial<AdminApiKeysLabels>): AdminApiKeysLabels {
  if (!given) return defaultAdminApiKeysLabels
  const out: Record<string, unknown> = { ...defaultAdminApiKeysLabels }
  for (const [key, value] of Object.entries(given)) {
    const original = (defaultAdminApiKeysLabels as Record<string, unknown>)[key]
    out[key] =
      typeof original === 'object' && original !== null && typeof value === 'object'
        ? { ...original, ...value }
        : value
  }
  return out as AdminApiKeysLabels
}
