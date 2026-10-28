/** `AdminRoles` 의 문구. 부품은 i18n 을 모르고 앱이 언어에 맞는 것(`koAdminRolesLabels`)을 넘긴다 - 일부만 덮어써도 된다 */
export type AdminRolesLabels = {
  title: string
  caption: string
  create: string
  createTitle: string
  editTitle: (name: string) => string
  deleteTitle: (name: string) => string
  deleteBody: string
  /** 줄의 단추 글자 + 낭독 이름(어느 역할인지) */
  editButton: string
  removeButton: string
  edit: (name: string) => string
  remove: (name: string) => string
  save: string
  cancel: string
  close: string
  retry: string
  loading: string
  loadFailed: string
  empty: string
  columns: {
    name: string
    description: string
    permissions: string
    holders: string
    actions: string
  }
  nameLabel: string
  nameHint: string
  descriptionLabel: string
  permissionsLegend: string
  noPermissions: string
  /** 전권 역할 줄 옆 글자 - 고칠 수 없는 이유 */
  protectedNote: string
  /** 전권(`*`) 표시 */
  allPermissions: string
  holdersUnknown: string
  /** 호출자에게 없는 권한의 체크 상자 옆 글자 - 켜지도 끄지도 못하는 이유 */
  permissionOutside: string
  /** 호출자 권한 밖 권한을 가진 역할 줄 옆 글자 - 지울 수 없는 이유 */
  deleteOutside: string
  /** 표의 「포함하는 역할」 열 머리와 비었을 때 */
  includesColumn: string
  noIncludes: string
  /** 만들기 · 고치기 창의 포함 역할 묶음 */
  includesLegend: string
  includesHint: string
  /** 포함할 수 없는 후보 옆 글자 - 이유 */
  includeCycle: string
  /** 전권(`*`) 역할 후보 옆 글자 - 포함할 수 없는 이유 */
  includeFullAccess: string
  includeOutside: string
  /** 물려받은 권한 체크 상자 옆 글자 */
  inheritedFrom: (role: string) => string
  /** 모르는 권한 키는 키 그대로 보인다 - 아는 키의 이름 */
  permissionLabels: Record<string, string>
  /** 권한 묶음 제목(모듈 이름). 모르는 모듈은 이름 그대로 */
  moduleLabels: Record<string, string>
  errors: {
    protected: string
    inUse: string
    exists: string
    notFound: string
    permissionUnknown: string
    escalation: string
    selfLockout: string
    roleCycle: string
    includeUnknown: string
    roleIncluded: string
    validation: string
    generic: string
  }
}

export const defaultAdminRolesLabels: AdminRolesLabels = {
  title: 'Roles',
  caption: 'Roles and their permissions',
  create: 'Create a role',
  createTitle: 'Create a role',
  editTitle: (name) => `Edit ${name}`,
  deleteTitle: (name) => `Delete ${name}?`,
  deleteBody: 'Accounts can no longer be given this role. This cannot be undone.',
  editButton: 'Edit',
  removeButton: 'Delete',
  edit: (name) => `Edit ${name}`,
  remove: (name) => `Delete ${name}`,
  save: 'Save',
  cancel: 'Cancel',
  close: 'Close',
  retry: 'Try again',
  loading: 'Loading',
  loadFailed: 'Could not load the roles.',
  empty: 'There are no roles yet.',
  columns: {
    name: 'Role',
    description: 'Description',
    permissions: 'Permissions',
    holders: 'Accounts',
    actions: 'Actions',
  },
  nameLabel: 'Role name',
  nameHint: 'Capital letters, digits and underscores, for example CS_AGENT.',
  descriptionLabel: 'Description',
  permissionsLegend: 'Permissions',
  noPermissions: 'No permissions',
  protectedNote: 'Full-access role - it cannot be changed or deleted.',
  allPermissions: 'Everything',
  holdersUnknown: '-',
  permissionOutside: 'You do not hold this permission, so you cannot change it.',
  deleteOutside: 'It has permissions you do not hold, so you cannot delete it.',
  includesColumn: 'Includes',
  noIncludes: '-',
  includesLegend: 'Includes these roles',
  includesHint: 'Everything the included roles can do, this role can do too.',
  includeFullAccess: 'A full-access role cannot be included.',
  includeCycle: 'It already includes this role, so including it would make a loop.',
  includeOutside: 'It has permissions you do not hold, so you cannot include it.',
  inheritedFrom: (role) => `Inherited from ${role}`,
  permissionLabels: {
    'account.read': 'View accounts',
    'account.manage': 'Suspend and restore accounts',
    'account.roles': 'Give and take roles',
    'author-profile.read': 'View author links',
    'payment.read': 'View payments',
    'payment.refund': 'Approve and make refunds',
    'payment.operate': 'Sync with the provider, close charges, retry webhooks',
    'board.moderate': 'Hide posts and comments',
    'board.manage': 'Manage boards',
    'legal.read': 'View consent records',
    'authz.roles': 'Manage roles',
    'campaign.manage': 'Manage events',
    'coupon.manage': 'Manage coupons and give them out',
    'point.manage': 'Adjust points',
    'reward.operate': 'Retry and stop reward grants',
    'payment.exempt': 'Use paid features without paying',
  },
  moduleLabels: {
    account: 'Accounts',
    'author-profile': 'Author profiles',
    payment: 'Payments',
    board: 'Board',
    legal: 'Legal',
    authz: 'Roles',
    campaign: 'Events',
    coupon: 'Coupons',
    point: 'Points',
    reward: 'Reward grants',
  },
  errors: {
    protected:
      'This is the full-access role. It cannot be changed or deleted, and no other role can get everything.',
    inUse: 'Accounts still have this role, so it cannot be deleted. Take it from them first.',
    exists: 'A role with this name already exists.',
    notFound: 'This role no longer exists. The list was refreshed.',
    permissionUnknown: 'One of the permissions is not known to this server. Refresh and try again.',
    escalation: 'You can only give a role permissions that you hold yourself.',
    selfLockout: 'This change would take away your own right to manage roles.',
    roleCycle: 'Those roles include each other, which would make a loop. Pick a different role.',
    includeUnknown: 'One of the included roles does not exist. The list was refreshed.',
    roleIncluded:
      'Another role includes this one, so it cannot be deleted. Remove it from that role first.',
    validation: 'Check the role name and try again.',
    generic: 'Something went wrong. Try again.',
  },
}

export const koAdminRolesLabels: Partial<AdminRolesLabels> = {
  title: '역할',
  caption: '역할과 권한',
  create: '역할 만들기',
  createTitle: '역할 만들기',
  editTitle: (name) => `${name} 고치기`,
  deleteTitle: (name) => `${name} 역할을 지울까요?`,
  deleteBody: '이 역할은 더 이상 계정에 줄 수 없어요. 되돌릴 수 없어요.',
  editButton: '고치기',
  removeButton: '지우기',
  edit: (name) => `${name} 고치기`,
  remove: (name) => `${name} 지우기`,
  save: '저장',
  cancel: '취소',
  close: '닫기',
  retry: '다시 시도',
  loading: '불러오는 중',
  loadFailed: '역할을 불러오지 못했어요.',
  empty: '아직 역할이 없어요.',
  columns: {
    name: '역할',
    description: '설명',
    permissions: '권한',
    holders: '계정 수',
    actions: '동작',
  },
  nameLabel: '역할 이름',
  nameHint: '영문 대문자 · 숫자 · 밑줄, 예: CS_AGENT',
  descriptionLabel: '설명',
  permissionsLegend: '권한',
  noPermissions: '권한 없음',
  protectedNote: '전권 역할이라 고치거나 지울 수 없어요.',
  allPermissions: '전체',
  holdersUnknown: '-',
  permissionOutside: '내게 없는 권한이라 바꿀 수 없어요.',
  deleteOutside: '내게 없는 권한이 들어 있어 지울 수 없어요.',
  includesColumn: '포함하는 역할',
  noIncludes: '-',
  includesLegend: '포함하는 역할',
  includesHint: '포함한 역할이 할 수 있는 일은 이 역할도 할 수 있어요.',
  includeFullAccess: '전권 역할은 포함할 수 없어요.',
  includeCycle: '이미 이 역할을 포함하고 있어 포함하면 고리가 생겨요.',
  includeOutside: '내게 없는 권한이 들어 있어 포함할 수 없어요.',
  inheritedFrom: (role) => `${role}에서 물려받음`,
  permissionLabels: {
    'account.read': '계정 보기',
    'account.manage': '계정 정지 · 복구',
    'account.roles': '역할 주고 회수하기',
    'author-profile.read': '작성자 연결 보기',
    'payment.read': '결제 보기',
    'payment.refund': '환불 승인 · 환불하기',
    'payment.operate': '결제사와 맞추기 · 결제 닫기 · 웹훅 다시 처리',
    'board.moderate': '글 · 댓글 숨기기',
    'board.manage': '게시판 관리',
    'legal.read': '동의 기록 보기',
    'authz.roles': '역할 관리',
    'campaign.manage': '이벤트 관리',
    'coupon.manage': '쿠폰 관리 · 주기',
    'point.manage': '포인트 조정',
    'reward.operate': '보상 지급 다시 하기 · 멈추기',
    'payment.exempt': '결제 없이 이용(결제 면제)',
  },
  moduleLabels: {
    account: '계정',
    'author-profile': '작성자 프로필',
    payment: '결제',
    board: '게시판',
    legal: '약관',
    authz: '역할',
    campaign: '이벤트',
    coupon: '쿠폰',
    point: '포인트',
    reward: '보상 지급',
  },
  errors: {
    protected: '전권 역할이에요. 고치거나 지울 수 없고, 다른 역할에 전권을 줄 수도 없어요.',
    inUse: '이 역할을 가진 계정이 있어 지울 수 없어요. 먼저 그 계정에서 회수해 주세요.',
    exists: '같은 이름의 역할이 이미 있어요.',
    notFound: '이 역할이 이제 없어요. 목록을 새로 불러왔어요.',
    permissionUnknown: '이 서버가 모르는 권한이 들어 있어요. 새로 고친 뒤 다시 해 보세요.',
    escalation: '내가 가진 권한만 역할에 담을 수 있어요.',
    selfLockout: '이렇게 바꾸면 내가 역할을 관리할 수 없게 돼요.',
    roleCycle: '두 역할이 서로를 포함해 고리가 생겨요. 다른 역할을 골라 주세요.',
    includeUnknown: '포함하려는 역할 중 이제 없는 것이 있어요. 목록을 새로 불러왔어요.',
    roleIncluded: '다른 역할이 이 역할을 포함하고 있어 지울 수 없어요. 먼저 그 역할에서 빼 주세요.',
    validation: '역할 이름을 확인하고 다시 해 보세요.',
    generic: '문제가 생겼어요. 다시 해 보세요.',
  },
}

export function mergeRolesLabels(given?: Partial<AdminRolesLabels>): AdminRolesLabels {
  return {
    ...defaultAdminRolesLabels,
    ...given,
    columns: { ...defaultAdminRolesLabels.columns, ...given?.columns },
    permissionLabels: { ...defaultAdminRolesLabels.permissionLabels, ...given?.permissionLabels },
    moduleLabels: { ...defaultAdminRolesLabels.moduleLabels, ...given?.moduleLabels },
    errors: { ...defaultAdminRolesLabels.errors, ...given?.errors },
  }
}
