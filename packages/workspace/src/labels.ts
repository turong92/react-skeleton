import type { WorkspaceRole } from './types'
import { defaultWorkspaceLabels } from './labels.en'

export type WorkspaceLabels = {
  loading: string
  loadFailed: string
  retry: string
  cancel: string
  close: string
  roles: Record<WorkspaceRole, string>
  /** 주소의 워크스페이스를 찾지 못했을 때(없음 · 멤버 아님 · 닫힘이 모두 같은 화면) */
  notFound: { title: string; description: string }
  /** 이름 · 주소 이름 칸(만들기와 설정이 같이 쓴다) */
  form: {
    nameLabel: string
    nameRequired: string
    nameTooLong: (max: number) => string
    slugLabel: string
    slugHint: string
    slugLength: (min: number, max: number) => string
    slugFormat: string
    slugTaken: string
    failed: string
  }
  switcher: {
    /** 단추 이름(낭독) — 지금 팀 이름이 있으면 함께 */
    trigger: (currentName: string | undefined) => string
    choose: string
    create: string
    loading: string
  }
  create: { title: string; submit: string }
  settings: {
    generalTitle: string
    readOnlyHint: string
    save: string
    saved: string
    membersTitle: string
    membersCount: (count: number) => string
    membersCaption: string
    columnMember: string
    columnRole: string
    columnJoined: string
    columnActions: string
    you: string
    unnamedMember: string
    roleOf: (name: string) => string
    actionsOf: (name: string) => string
    removeAction: string
    transferAction: string
    removeDialog: {
      title: (name: string) => string
      description: (name: string) => string
      confirm: string
    }
    transferDialog: {
      title: string
      description: (name: string, workspaceName: string) => string
      confirm: string
    }
    memberChangeFailed: string
    memberGone: string
    leave: {
      title: string
      description: string
      action: string
      ownerHint: string
      dialogTitle: (workspaceName: string) => string
      dialogDescription: string
      confirm: string
      ownerCannotLeave: string
      failed: string
    }
  }
  invitations: {
    title: string
    description: string
    noPermission: string
    /** 좌석 `n / 상한`(멤버 + 대기 초대) */
    seats: (used: number, limit: number) => string
    seatsFull: string
    emailsLabel: string
    emailsHint: string
    emailsRequired: string
    /** 모양이 틀린 주소들을 쉼표로 이은 글을 받는다 */
    emailsInvalid: (addresses: string) => string
    emailsTooMany: (max: number) => string
    roleLabel: string
    send: string
    sendFailed: string
    tooManyPending: string
    forbidden: string
    result: {
      invited: (count: number) => string
      alreadyInvited: (count: number) => string
      seatLimited: (count: number) => string
      alreadyMember: (count: number) => string
    }
    pendingTitle: string
    pendingCount: (count: number) => string
    pendingCaption: string
    pendingEmpty: string
    columnEmail: string
    columnRole: string
    columnExpires: string
    columnSent: string
    columnActions: string
    expired: string
    sentCount: (count: number) => string
    resend: string
    resendFor: (email: string) => string
    resent: (email: string) => string
    /** 같은 초대는 60초 안에 다시 못 보낸다 — 서버가 알려 준 기다릴 초가 있으면 받는다 */
    resendTooSoon: (seconds: number | undefined) => string
    resendFailed: string
    revoke: string
    revokeFor: (email: string) => string
    revokeDialog: { title: (email: string) => string; description: string; confirm: string }
    revokeFailed: string
  }
  accept: {
    title: string
    invitedTo: (workspaceName: string) => string
    invitedBy: (inviter: string) => string
    asRole: (role: string) => string
    sentTo: (emailMasked: string) => string
    expiresAt: (when: string) => string
    signInHint: string
    signIn: string
    accept: string
    goHome: string
    problems: {
      expired: string
      used: string
      invalid: string
      emailMismatch: (emailMasked: string) => string
      emailUnverified: string
      alreadyMember: string
      seatLimit: string
      failed: string
    }
  }
}

/** 앱이 준 일부 문구(안쪽도 일부만 가능) */
export type WorkspaceLabelsInput = {
  [K in keyof WorkspaceLabels]?: WorkspaceLabels[K] extends (...args: never[]) => unknown
    ? WorkspaceLabels[K]
    : WorkspaceLabels[K] extends object
      ? Partial<WorkspaceLabels[K]>
      : WorkspaceLabels[K]
}

export { defaultWorkspaceLabels } from './labels.en'
export { koWorkspaceLabels } from './labels.ko'

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

function merge<T>(base: T, over: unknown): T {
  if (!isPlainObject(base) || !isPlainObject(over)) return (over === undefined ? base : over) as T
  const out: Record<string, unknown> = { ...base }
  for (const [key, value] of Object.entries(over))
    if (value !== undefined) out[key] = merge(base[key], value)
  return out as T
}

export function resolveWorkspaceLabels(input: WorkspaceLabelsInput = {}): WorkspaceLabels {
  return merge<WorkspaceLabels>(defaultWorkspaceLabels, input)
}
