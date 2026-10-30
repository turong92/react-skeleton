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
  invitations: {
    title: 'Invite people',
    description: 'They get an email with a link that lasts 7 days.',
    noPermission: 'Only owners and admins can invite people.',
    seats: (used, limit) => `Seats ${used} / ${limit}`,
    seatsFull: 'All seats are taken. Remove someone or cancel an invitation to invite more.',
    emailsLabel: 'Email addresses',
    emailsHint: 'Separate several addresses with commas, spaces or new lines. Up to 20 at a time.',
    emailsRequired: 'Enter at least one email address.',
    emailsInvalid: (addresses) => `These do not look like email addresses: ${addresses}`,
    emailsTooMany: (max) => `Invite at most ${max} people at a time.`,
    roleLabel: 'Role',
    send: 'Send invitations',
    sendFailed: 'Could not send the invitations. Try again.',
    tooManyPending: 'Too many invitations are waiting. Cancel some first.',
    forbidden: 'You are not allowed to invite people to this workspace.',
    result: {
      invited: (count) => (count === 1 ? 'Invited 1 person' : `Invited ${count} people`),
      alreadyInvited: (count) =>
        count === 1
          ? '1 address already has an invitation waiting (resend it from the table)'
          : `${count} addresses already have an invitation waiting (resend them from the table)`,
      seatLimited: (count) =>
        count === 1
          ? '1 address was not invited: no seats left'
          : `${count} addresses were not invited: no seats left`,
      alreadyMember: (count) =>
        count === 1 ? '1 address is already a member' : `${count} addresses are already members`,
    },
    pendingTitle: 'Waiting for an answer',
    pendingCount: (count) => (count === 1 ? '1 invitation' : `${count} invitations`),
    pendingCaption: 'Pending invitations',
    pendingEmpty: 'No invitations are waiting.',
    columnEmail: 'Email',
    columnRole: 'Role',
    columnExpires: 'Expires',
    columnSent: 'Sent',
    columnActions: 'Actions',
    expired: 'Expired',
    sentCount: (count) => (count === 1 ? 'Once' : `${count} times`),
    resend: 'Resend',
    resendFor: (email) => `Resend the invitation to ${email}`,
    resent: (email) => `Sent again to ${email}. The old link no longer works.`,
    resendTooSoon: (seconds) =>
      seconds === undefined
        ? 'You just sent this. Wait a moment before sending it again.'
        : `You just sent this. Try again in ${seconds} seconds.`,
    resendFailed: 'Could not resend. Try again.',
    revoke: 'Cancel',
    revokeFor: (email) => `Cancel the invitation to ${email}`,
    revokeDialog: {
      title: (email) => `Cancel the invitation to ${email}?`,
      description: 'The link in the email stops working right away.',
      confirm: 'Cancel invitation',
    },
    revokeFailed: 'Could not cancel the invitation. Try again.',
  },
  accept: {
    title: 'Workspace invitation',
    invitedTo: (workspaceName) => `You are invited to ${workspaceName}`,
    invitedBy: (inviter) => `Invited by ${inviter}`,
    asRole: (role) => `You will join as ${role}`,
    sentTo: (emailMasked) => `This invitation was sent to ${emailMasked}.`,
    expiresAt: (when) => `Valid until ${when}`,
    signInHint:
      'Sign in or create an account with that email address first, then come back to accept.',
    signIn: 'Sign in or sign up to accept',
    accept: 'Accept invitation',
    goHome: 'Go to the start page',
    problems: {
      expired: 'This invitation has expired. Ask the person who invited you to send a new one.',
      used: 'This invitation was already used or cancelled. Ask for a new one if you still need to join.',
      invalid: 'This invitation link is not valid. Check that you opened the latest email.',
      emailMismatch: (emailMasked) =>
        `You are signed in with a different account. Sign in with the account for ${emailMasked} to accept.`,
      emailUnverified:
        'Your email address is not verified yet. Verify it from the email we sent, then accept again.',
      alreadyMember: 'You are already a member of this workspace.',
      seatLimit: 'This workspace has no seats left. Ask an owner or admin to make room.',
      failed: 'Could not accept the invitation. Try again.',
    },
  },
}
