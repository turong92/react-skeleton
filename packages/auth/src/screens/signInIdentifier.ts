import type { AuthLabels } from './labels'

/**
 * 로그인 화면이 `onPasswordSignIn` 에 넘기는 값 — 예전 모양(`{ email, password }`)은 그대로이고, 아이디를 켠 화면에서 `@` 없는 입력만 `{ username, password }` 로 간다.
 * `POST /auth/login` 본문(`PasswordLoginRequest`)의 부분집합이라 `auth.login(credentials)` 에 그대로 넘기면 된다
 */
export type SignInCredentials = { password: string } & (
  | { email: string; username?: never }
  | { username: string; email?: never }
)

/**
 * 입력을 요청 본문으로 바꾸는 **한 군데**. 아이디를 켠 서버에서 `@` 가 있으면 이메일(`email` 은 254자), 없으면 아이디(`username` 은 64자 — 그래서 나눠 싣는다).
 * 아이디는 trim 만 한다 - 대문자 · 정규화는 서버가 한다. 꺼져 있으면 예전처럼 늘 `email` 에 입력 그대로
 */
export function signInCredentials(
  identifier: string,
  password: string,
  loginIdOn: boolean,
): SignInCredentials {
  if (loginIdOn && !identifier.includes('@')) return { username: identifier.trim(), password }
  return { email: identifier, password }
}

/**
 * 입력칸의 막힌 이유. 꺼져 있으면 비었을 때만(예전 그대로). 켜져 있으면 비밀번호 방식은 비었을 때만 「아이디 또는 이메일」,
 * 링크 방식은 주소로 보내는 것이라 `@` 가 없으면 「이메일을 입력해 주세요」
 */
export function identifierProblem(
  value: string,
  mode: 'password' | 'magic',
  loginIdOn: boolean,
  labels: Pick<AuthLabels, 'problemEmailMissing' | 'problemIdentifierMissing'>,
): string | undefined {
  const text = value.trim()
  if (!loginIdOn) return text ? undefined : labels.problemEmailMissing
  if (mode === 'magic') return text.includes('@') ? undefined : labels.problemEmailMissing
  return text ? undefined : labels.problemIdentifierMissing
}
