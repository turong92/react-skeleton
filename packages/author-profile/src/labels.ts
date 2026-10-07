import type { Duration } from './duration'

/**
 * 선택기 · 관리 화면의 모든 문구 — 패키지는 영어 기본값만 갖고, 앱이 번역해 `labels` prop 으로 일부 또는 전부를 덮는다.
 * `…(name)` 꼴은 `이름#꼬리표`(꼬리표 · 이름이 없으면 그것 없이)를 받는다.
 */
export type AuthorProfileLabels = {
  // ── 선택기
  /** 아무것도 고르지 않았을 때 단추의 글자 */
  choose: string
  /** 선택기 단추의 낭독 이름 — `current` 는 지금 고른 `이름#꼬리표`(없으면 undefined). 보이는 글자를 포함하게 쓴다 */
  triggerLabel: (current: string | undefined) => string
  /** 목록을 불러오는 중 */
  loading: string
  /** 불러오기에 실패 — 누르면 다시 시도하는 단추의 글자 */
  loadFailed: string
  /** 프로필이 하나도 없을 때(만들기 진입이 없는 앱) */
  noProfiles: string
  /** 프로필이 하나도 없을 때 만들기로 가는 단추 */
  createProfile: string
  /** 이름이 없는 프로필(이름 없는 옛 글을 넘겨받은 첫 프로필)을 가리키는 말 */
  unnamed: string
  /** 이 스레드의 댓글을 아직 받는 중 — 선택기 단추가 잠기고 이 글이 보인다(보이는 글자 = 낭독 이름) */
  threadLoading: string
  /** 이 스레드에서 다른 프로필로 쓴 적이 있을 때 한 줄 — `threadName` 은 그 프로필 */
  switchNotice: (threadName: string) => string
  /** 바꾸기를 확인하는 단추 */
  switchConfirm: (nextName: string) => string
  /** 바꾸지 않고 **지금 고른 프로필**을 유지하는 단추 — `currentName` 은 지금 값(이 스레드의 프로필과 다를 수 있다) */
  switchKeep: (currentName: string) => string
  // ── 관리
  /** 목록의 낭독 이름 */
  listLabel: string
  empty: string
  /** `n` 개 중 상한 `max` */
  count: (n: number, max: number) => string
  nameLabel: string
  nameHint: (max: number) => string
  add: string
  adding: string
  /** 각 줄의 단추에 보이는 글자 */
  renameAction: string
  removeAction: string
  /** 각 줄의 단추의 낭독 이름 — 이름을 넣어 줄을 가리킨다(보이는 글자를 포함하게) */
  rename: (name: string) => string
  renameLabel: (name: string) => string
  save: string
  saving: string
  cancel: string
  remove: (name: string) => string
  // 삭제 확인 창
  deleteTitle: (name: string) => string
  /** 되돌릴 수 없고 이 프로필의 글 · 댓글은 「삭제된 사용자」로 남는다는 것을 말한다 */
  deleteDescription: (name: string) => string
  deleteConfirm: string
  deleteCancel: string
  deleteClose: string
  // ── 오류
  nameRequired: string
  namePattern: string
  nameReserved: string
  nameTooLong: (max: number) => string
  nameTaken: string
  limitReached: (max: number) => string
  /** `wait` 는 기다려야 하는 시간(`foldDuration` 으로 접은 단위 — 초 · 분 · 시간 · 일), 서버가 안 알렸으면 undefined */
  rateLimited: (wait: Duration | undefined) => string
  notFound: string
  failed: string
}

export const defaultAuthorProfileLabels: AuthorProfileLabels = {
  choose: 'Choose a profile',
  unnamed: 'Unnamed',
  threadLoading: 'Loading this thread',
  triggerLabel: (current) =>
    current ? `Writing as ${current}. Change profile` : 'Choose a profile',
  loading: 'Loading profiles',
  loadFailed: 'Could not load profiles. Try again',
  noProfiles: 'No profiles yet',
  createProfile: 'Create a profile',
  switchNotice: (threadName) => `You wrote in this thread as ${threadName}.`,
  switchConfirm: (nextName) => `Use ${nextName}`,
  switchKeep: (currentName) => `Keep ${currentName}`,
  listLabel: 'Your profiles',
  empty: 'You have no profiles yet.',
  count: (n, max) => `${n} of ${max} profiles`,
  nameLabel: 'New profile name',
  nameHint: (max) => `Up to ${max} characters. A tag may be added to tell same names apart.`,
  add: 'Add profile',
  adding: 'Adding',
  renameAction: 'Rename',
  removeAction: 'Delete',
  rename: (name) => `Rename ${name}`,
  renameLabel: (name) => `New name for ${name}`,
  save: 'Save',
  saving: 'Saving',
  cancel: 'Cancel',
  remove: (name) => `Delete ${name}`,
  deleteTitle: (name) => `Delete ${name}?`,
  deleteDescription: (name) =>
    `This cannot be undone. Posts and comments written as ${name} stay, shown as "Deleted user".`,
  deleteConfirm: 'Delete profile',
  deleteCancel: 'Cancel',
  deleteClose: 'Close',
  nameRequired: 'Enter a name.',
  namePattern: 'That name has characters that are not allowed.',
  nameReserved: 'That name is not available.',
  nameTooLong: (max) => `Use ${max} characters or fewer.`,
  nameTaken: 'That name is taken.',
  limitReached: (max) => `You can have up to ${max} profiles.`,
  rateLimited: (wait) =>
    wait === undefined
      ? 'Too many profile changes. Try again later.'
      : `Too many profile changes. Try again in ${wait.value} ${wait.unit}${wait.value === 1 ? '' : 's'}.`,
  notFound: 'That profile no longer exists.',
  failed: 'Something went wrong. Try again.',
}

export const mergeLabels = (given?: Partial<AuthorProfileLabels>): AuthorProfileLabels => ({
  ...defaultAuthorProfileLabels,
  ...given,
})
