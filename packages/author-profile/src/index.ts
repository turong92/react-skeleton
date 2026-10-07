export type { AuthorProfile, AuthorProfileConfig, AuthorProfileInput } from './types'
export { profileDisplay } from './types'
export { createAuthorProfileApi } from './authorProfileApi'
export type { AuthorProfileApi, AuthorProfileApiOptions, CreateOptions } from './authorProfileApi'
export { authorProfileKeys, configQuery, listQuery } from './queries'
export { createProfileMutation, removeProfileMutation, renameProfileMutation } from './mutations'
export {
  useAuthorProfileConfig,
  useAuthorProfiles,
  useCreateAuthorProfile,
  useRemoveAuthorProfile,
  useRenameAuthorProfile,
} from './hooks'
export { browserLocalStorage, createAuthorMemory } from './authorMemory'
export type { AuthorMemory, StorageLike } from './authorMemory'
export { resolveInitialAuthor, switchNotice } from './initialAuthor'
export { defaultAuthorProfileLabels } from './labels'
export type { AuthorProfileLabels } from './labels'
export { isAuthorProfileFormError, nameProblem, profileFormProblem } from './errors'
export type { ProfileFormProblem } from './errors'
export { AuthorPicker, AuthorPickerView } from './AuthorPicker'
export type {
  AuthorPickerProps,
  AuthorPickerSlotProps,
  AuthorPickerViewProps,
} from './AuthorPicker'
export { AuthorProfileManager } from './AuthorProfileManager'
export type { AuthorProfileManagerProps } from './AuthorProfileManager'
