/** Vite 의 기본 모드 — 이 밖의 이름으로 `vite build --mode <이름>` 하면 「프로젝트 빌드」다(`.env.<이름>` 을 읽는다) */
const DEFAULT_MODES = new Set(['production', 'development', 'test'])

/**
 * 프로젝트별 정적 빌드 검사. 정적 호스트(Cloudflare Pages)에는 `/api/v1` 이 없으므로 API 의 절대 주소(`VITE_API_BASE_URL`)가 없으면
 * 빌드를 멈춘다 — 빠뜨리고 올리면 모든 호출이 호스트의 HTML 404 로 간다. 기본 빌드 · 개발 서버는 건드리지 않는다.
 */
export function assertProjectBuildEnv(
  mode: string,
  command: 'build' | 'serve',
  env: Record<string, string | undefined>,
): void {
  if (command !== 'build' || DEFAULT_MODES.has(mode)) return
  if (!/^[a-z][a-z0-9-]*$/.test(mode))
    throw new Error(`project name must be lower-case letters, digits, hyphens (got "${mode}")`)
  if (!/^https?:\/\/[^\s/]+/.test(env.VITE_API_BASE_URL?.trim() ?? ''))
    throw new Error(
      `project build "${mode}" needs VITE_API_BASE_URL — the absolute API address of this project (e.g. https://api.${mode}.example.com/api/v1), in apps/sample/.env.${mode} or the Pages build environment`,
    )
}
