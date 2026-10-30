import {
  defaultWorkspaceLabels,
  koWorkspaceLabels,
  type WorkspaceLabels,
} from '@skeleton/workspace'
import {
  defaultWorkspaceAdminLabels,
  koWorkspaceAdminLabels,
  type WorkspaceAdminLabels,
} from '@skeleton/workspace/admin'

/** 패키지 사전을 화면 언어에 맞게 고른다 */
export const workspaceLabelsFor = (language: 'ko' | 'en'): WorkspaceLabels =>
  language === 'ko' ? koWorkspaceLabels : defaultWorkspaceLabels
export const workspaceAdminLabelsFor = (language: 'ko' | 'en'): WorkspaceAdminLabels =>
  language === 'ko' ? koWorkspaceAdminLabels : defaultWorkspaceAdminLabels
