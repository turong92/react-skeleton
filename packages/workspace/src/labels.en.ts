import type { WorkspaceLabels } from './labels'

/** 기본 문구(영어) */
export const defaultWorkspaceLabels: WorkspaceLabels = {
  loading: 'Loading',
  loadFailed: 'Could not load this. Try again.',
  retry: 'Try again',
  cancel: 'Cancel',
  close: 'Close',
  roles: { OWNER: 'Owner', ADMIN: 'Admin', MEMBER: 'Member' },
  notFound: {
    title: 'Workspace not found',
    description:
      'This workspace does not exist, or you are not a member of it. Ask an owner or admin to invite you.',
  },
  form: {
    nameLabel: 'Workspace name',
    nameRequired: 'Enter a name.',
    nameTooLong: (max) => `Use at most ${max} characters.`,
    slugLabel: 'Web address name',
    slugHint:
      'Lowercase letters, numbers and hyphens, 3 to 40 characters. It appears in the address.',
    slugLength: (min, max) => `Use ${min} to ${max} characters.`,
    slugFormat:
      'Use only lowercase letters, numbers and hyphens, not starting or ending with a hyphen.',
    slugTaken: 'This address name is already taken. Try another.',
    failed: 'Could not save. Try again.',
  },
  switcher: {
    trigger: (currentName) =>
      currentName ? `Switch workspace, current: ${currentName}` : 'Choose a workspace',
    choose: 'Choose a workspace',
    create: 'New workspace',
    loading: 'Loading workspaces',
  },
  create: { title: 'Create a workspace', submit: 'Create workspace' },
  settings: {
    generalTitle: 'Workspace',
    readOnlyHint: 'Only owners and admins can change the name and address.',
    save: 'Save changes',
    saved: 'Saved',
    membersTitle: 'Members',
    membersCount: (count) => (count === 1 ? '1 member' : `${count} members`),
    membersCaption: 'Workspace members',
    columnMember: 'Member',
    columnRole: 'Role',
    columnJoined: 'Joined',
    columnActions: 'Actions',
    you: 'you',
    unnamedMember: 'Unnamed member',
    roleOf: (name) => `Role of ${name}`,
    actionsOf: (name) => `Actions for ${name}`,
    removeAction: 'Remove from workspace',
    transferAction: 'Transfer ownership',
    removeDialog: {
      title: (name) => `Remove ${name}?`,
      description: (name) =>
        `${name} loses access to this workspace from their next request. What they wrote stays.`,
      confirm: 'Remove',
    },
    transferDialog: {
      title: 'Transfer ownership',
      description: (name, workspaceName) =>
        `${name} becomes the owner of ${workspaceName} and you become an admin. Only the new owner can undo this.`,
      confirm: 'Transfer ownership',
    },
    memberChangeFailed: 'Could not change this member. Try again.',
    memberGone: 'This person is no longer a member. The list was refreshed.',
    leave: {
      title: 'Leave workspace',
      description: 'You lose access to this workspace. Ask an owner or admin if you want back in.',
      action: 'Leave workspace',
      ownerHint: 'You are the owner. Transfer ownership to another member before you leave.',
      dialogTitle: (workspaceName) => `Leave ${workspaceName}?`,
      dialogDescription: 'You lose access to this workspace right away.',
      confirm: 'Leave',
      ownerCannotLeave: 'The owner cannot leave. Transfer ownership first.',
      failed: 'Could not leave. Try again.',
    },
  },
}
