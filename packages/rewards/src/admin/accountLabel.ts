/** 찾은 계정 한 줄 - 운영자가 고른다. 앱이 계정 API(`GET /admin/accounts?email=&loginId=`)를 이 꼴로 옮겨 준다 */
export type AccountChoice = { id: string; email: string | null; loginId?: string | null }

/** 계정 이름표 - 이메일(없으면 로그인 아이디, 그것도 없으면 id) */
export const accountLabelOf = (account: AccountChoice) =>
  account.email ?? account.loginId ?? account.id
