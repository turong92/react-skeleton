import type { AuthorProfileLabels } from '@skeleton/author-profile'
import type { useT } from '../i18n'

type Translate = ReturnType<typeof useT>['t']

/** `@skeleton/author-profile` 부품의 글자(화면에서는 「닉네임」 하나 — 「프로필」은 코드 이름이다) — 부품은 i18n 을 모르고 글자는 prop 이라, 화면이 지금 언어의 사전(`t`)에서 골라 넘긴다 */
export const authorProfileLabels = (t: Translate): AuthorProfileLabels => ({
  choose: t('author.choose'),
  triggerLabel: (current) =>
    current ? t('author.triggerLabel', { current }) : t('author.triggerChoose'),
  loading: t('author.loading'),
  loadFailed: t('author.loadFailed'),
  noProfiles: t('author.noProfiles'),
  createProfile: t('author.createProfile'),
  unnamed: t('author.unnamed'),
  threadLoading: t('author.threadLoading'),
  switchNotice: (thread, next) => t('author.switchNotice', { thread, next }),
  switchConfirm: t('author.switchConfirm'),
  switchKeep: t('author.switchKeep'),
  listLabel: t('author.listLabel'),
  empty: t('author.empty'),
  count: (n, max) => t('author.count', { n, max }),
  nameLabel: t('author.nameLabel'),
  nameHint: (max) => t('author.nameHint', { max }),
  add: t('author.add'),
  adding: t('author.adding'),
  renameAction: t('author.renameAction'),
  removeAction: t('author.removeAction'),
  rename: (name) => t('author.rename', { name }),
  renameLabel: (name) => t('author.renameLabel', { name }),
  save: t('author.save'),
  saving: t('author.saving'),
  cancel: t('author.cancel'),
  remove: (name) => t('author.remove', { name }),
  deleteTitle: (name) => t('author.deleteTitle', { name }),
  deleteDescription: (name) => t('author.deleteDescription', { name }),
  deleteConfirm: t('author.deleteConfirm'),
  deleteCancel: t('author.deleteCancel'),
  deleteClose: t('author.deleteClose'),
  nameRequired: t('author.nameRequired'),
  namePattern: t('author.namePattern'),
  nameReserved: t('author.nameReserved'),
  nameTooLong: (max) => t('author.nameTooLong', { max }),
  nameTaken: t('author.nameTaken'),
  limitReached: (max) => t('author.limitReached', { max }),
  rateLimited: (wait) =>
    wait
      ? t('author.rateLimitedIn', { value: wait.value, unit: wait.unit })
      : t('author.rateLimited'),
  notFound: t('author.notFound'),
  failed: t('author.failed'),
})
