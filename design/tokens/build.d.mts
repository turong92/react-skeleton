export type TokenLayer = 'primitive' | 'semantic'

export interface ThemeValue {
  /** 정본 $extensions.skeleton.<테마> 그대로 — 없으면 null(기본 값이 그 테마에서도 쓰인다) */
  raw: string | null
  references: string[]
  /** 그 테마 블록에 쓰는 값(참조는 var(--…)) — 없으면 null */
  value: string | null
  /** 그 테마에서 끝까지 푼 값 */
  resolved: string
}

export interface Token {
  /** 정본 경로 — `color.neutral.50` · `semantic.surface.bg` */
  path: string
  layer: TokenLayer
  /** 부모 묶음 경로 */
  group: string
  /** CSS 이름 — 원시 `--p-…`, 의미 `--<이름>` */
  cssName: string
  /** W3C $type(묶음에서 물려받은 값 포함) */
  type: string | undefined
  /** 정본 $value 그대로(참조 `{…}` 포함) */
  raw: string
  description: string
  references: string[]
  /** CSS 에 쓰는 값 — 참조는 var(--…) */
  value: string
  /** 참조를 끝까지 푼 값(기본 테마) */
  resolved: string
  /** 기본 아닌 테마마다(정본 테마 목록 순서) */
  byTheme: Record<string, ThemeValue>
}

/** 정본 맨 위 $extensions.skeleton.themes 한 줄 — 첫 줄이 기본 */
export interface Theme {
  name: string
  title: string
  colorScheme: 'light' | 'dark'
  /** OS 설정(prefers-color-scheme)이 이 테마 쪽이면 data-theme 가 없거나 system 일 때도 쓴다 — 하나까지 */
  system: boolean
}

export interface TokenGroup {
  /** semantic.<절> */
  path: string
  title: string
  note: string
}

export type Tokens = Token[] & { groups: TokenGroup[]; themes: Theme[] }

export function resolveTokens(json: unknown): Tokens

export function build(options?: { root?: string; write?: boolean }): {
  css: string
  doc: string
  tokens: Tokens
}

/** 쓰지 않고 비교 — 어긋난 생성물 경로(레포 기준) */
export function check(options?: { root?: string }): string[]

/** 명령줄 — 0 성공 · 1 어긋남(--check) · 2 모르는 인자(쓰지 않는다) */
export function main(
  argv: string[],
  options?: {
    root?: string
    log?: (line: string) => void
    error?: (line: string) => void
  },
): 0 | 1 | 2
