// 디자인 토큰 생성기 — 정본 tokens.json → tokens.css (+ 선택: 문서의 표 구역).
// 의존성 없음(node 만). 사용: `pnpm tokens`(쓰기) · `pnpm tokens:check`(쓰지 않고 비교, 어긋나면 1).
// 경로는 모두 옵션 — root(기본: 이 패키지 폴더) 기준 상대 경로: --source · --css · --doc(없으면 문서는 건드리지 않는다).
// 모르는 인자는 사용법을 찍고 2 — 아무것도 쓰지 않는다. 테스트는 build({ write: false }) · main(argv, { root }) 로 부른다.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = dirname(fileURLToPath(import.meta.url))
const SOURCE = 'tokens.json'
const CSS_OUT = 'tokens.css'
const DOC_START = '<!-- tokens:start -->'
const DOC_END = '<!-- tokens:end -->'
/** 정본의 확장 키 — `$extensions.skeleton`. 프로젝트가 이름을 바꾸려면 여기 한 줄(과 tokens.json) */
const EXT = 'skeleton'
const REF = /\{([^{}]+)\}/g

/*
 * 테마 목록 — 정본 맨 위 `$extensions.skeleton.themes`(없으면 light · dark). 첫 테마가 기본: 의미 토큰의 `$value` 가
 * 그 값이고 `:root` 블록이 된다. 나머지 테마는 의미 토큰의 `$extensions.skeleton.<이름>` 값만 덮는
 * `html[data-theme='<이름>']` 블록. `system: true` 인 테마(하나까지)는 `@media (prefers-color-scheme: <colorScheme>)`
 * 안에서 data-theme 가 없거나 `system` 일 때도 같은 값을 쓴다 — OS 설정을 새로 고침 없이, CSS 만으로 따라간다.
 */
const DEFAULT_THEMES = [
  { name: 'light', colorScheme: 'light' },
  { name: 'dark', colorScheme: 'dark', system: true },
]
const themeAttr = (name) => `[data-theme='${name}']`

function readThemes(json) {
  const themes = json?.$extensions?.[EXT]?.themes ?? DEFAULT_THEMES
  if (!Array.isArray(themes) || themes.length === 0) throw new Error('themes list is empty')
  const names = new Set()
  for (const theme of themes) {
    if (!/^[a-z][a-z0-9-]*$/.test(theme?.name ?? ''))
      throw new Error(
        `theme name must be lowercase letters, digits, "-": ${JSON.stringify(theme?.name)}`,
      )
    if (theme.name === 'system')
      throw new Error('theme name "system" is reserved for "follow the OS"')
    if (names.has(theme.name)) throw new Error(`duplicate theme name: ${theme.name}`)
    if (!['light', 'dark'].includes(theme.colorScheme))
      throw new Error(`${theme.name}: colorScheme must be light | dark (form controls, scrollbars)`)
    names.add(theme.name)
  }
  if (themes[0].system) throw new Error(`${themes[0].name}: the default theme cannot be system`)
  if (themes.filter((t) => t.system).length > 1) throw new Error('at most one system theme')
  return themes.map((t) => ({ title: t.name, ...t, system: Boolean(t.system) }))
}

/*
 * 층은 셋 — 원시(primitive) → 의미(semantic) → 부품(component).
 * 부품 토큰 `component.<부품>.<이름>` 은 부품 CSS 가 쓰는 손잡이(`--<부품>-<이름>`)다. 테마 값을 두지 않는다 —
 * 다크는 참조한 의미 토큰을 따라간다. 원시 토큰은 참조하지 않고, 어떤 값에도 색 날값(#… · rgb() · 이름 색)을 쓰지 않는다.
 * 색($type color)은 의미 · 부품 토큰을 참조하거나 끄기 값(COMPONENT_KEYWORDS)이다. 색 아닌 값(모서리 · 흐림 · 그림자)은
 * 날값도 된다 — 예: `blur(16px) saturate(1.5)` · `9999px`.
 */
const layerOf = (path) =>
  path[0] === 'semantic' ? 'semantic' : path[0] === 'component' ? 'component' : 'primitive'
const COMPONENT_KEYWORDS = new Set(['none', 'transparent'])
const RAW_COLOR = /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/i
/** CSS 이름 색(transparent · currentColor 는 끄기 · 물려받기라 뺀다) — 참조 `{…}` 밖의 낱말만 본다 */
const NAMED_COLORS = new Set(
  'aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen'.split(
    ' ',
  ),
)
const hasRawColor = (raw) =>
  RAW_COLOR.test(raw) ||
  raw
    .replace(REF, ' ')
    .split(/[^a-z]+/i)
    .some((word) => NAMED_COLORS.has(word.toLowerCase()))

function cssNameOf(path) {
  if (layerOf(path) === 'semantic') return `--${path[path.length - 1]}`
  if (layerOf(path) === 'component') return `--${path.slice(1).join('-')}`
  return `--p-${(path[0] === 'color' ? path.slice(1) : path).join('-')}`
}

const refsOf = (raw) => [...raw.matchAll(REF)].map((m) => m[1])

/** 정본 JSON → 토큰 목록(정본 순서). 없는 참조 · 순환 참조 · 이름 겹침 · 모르는 테마 값은 던진다 */
export function resolveTokens(json) {
  const themes = readThemes(json)
  const [base, ...others] = themes
  const otherNames = new Set(others.map((t) => t.name))
  const tokens = []
  const groups = []
  const walk = (node, path, inheritedType) => {
    const type = node.$type ?? inheritedType
    if ('$value' in node) {
      const byTheme = {}
      for (const [key, value] of Object.entries(node.$extensions?.[EXT] ?? {})) {
        if (!otherNames.has(key))
          throw new Error(
            `${path.join('.')}: unknown theme value $extensions.${EXT}.${key} — non-default themes: ${others.map((t) => t.name).join(', ') || '(none)'}`,
          )
        if (layerOf(path) !== 'semantic')
          throw new Error(
            `${path.join('.')}: theme values (${key}) belong on semantic.* tokens only`,
          )
        byTheme[key] = { raw: String(value), references: refsOf(String(value)) }
      }
      tokens.push({
        path: path.join('.'),
        layer: layerOf(path),
        group: path.slice(0, -1).join('.'),
        cssName: cssNameOf(path),
        type,
        raw: String(node.$value),
        description: node.$description ?? '',
        references: refsOf(String(node.$value)),
        byTheme,
      })
      return
    }
    if (path.length === 2 && (path[0] === 'semantic' || path[0] === 'component'))
      groups.push({
        path: path.join('.'),
        title: `${path[0] === 'component' ? 'Component · ' : ''}${node.$extensions?.[EXT]?.title ?? path[1]}`,
        note: node.$description ?? '',
      })
    for (const [key, child] of Object.entries(node)) {
      if (key.startsWith('$')) continue
      if (child === null || typeof child !== 'object')
        throw new Error(`${[...path, key].join('.')}: neither a token nor a group`)
      walk(child, [...path, key], type)
    }
  }
  walk(json, [], undefined)

  const byPath = new Map(tokens.map((t) => [t.path, t]))
  const seen = new Map()
  for (const t of tokens) {
    if (seen.has(t.cssName))
      throw new Error(`css name collision: ${t.cssName} (${seen.get(t.cssName)} · ${t.path})`)
    seen.set(t.cssName, t.path)
    const themeRefs = Object.values(t.byTheme).flatMap((v) => v.references)
    for (const ref of [...t.references, ...themeRefs])
      if (!byPath.has(ref)) throw new Error(`${t.path}: missing reference {${ref}}`)
    if (t.layer === 'component') {
      if (t.path.split('.').length < 3)
        throw new Error(`${t.path}: component tokens are component.<part>.<name>`)
      for (const ref of t.references)
        if (byPath.get(ref).layer === 'primitive')
          throw new Error(
            `${t.path}: component tokens reference semantic or component tokens, not primitives {${ref}}`,
          )
      if (!t.type)
        throw new Error(
          `${t.path}: component tokens declare $type (color · dimension · shadow · string)`,
        )
      if (hasRawColor(t.raw))
        throw new Error(
          `${t.path}: no raw colours in component tokens — reference a semantic token instead ("${t.raw}")`,
        )
      if (t.type === 'color' && !t.references.length && !COMPONENT_KEYWORDS.has(t.raw.trim()))
        throw new Error(
          `${t.path}: a component colour references a semantic token, or is one of ${[...COMPONENT_KEYWORDS].join(' | ')} — got "${t.raw}"`,
        )
    }
  }

  // 테마마다 따로 푼다 — 그 테마 값이 있는 토큰은 그 값을, 없으면 기본 값(그 참조는 그 테마로 풀린다)을 쓴다
  const resolver = (theme) => {
    const resolved = new Map()
    const raw = (t) => t.byTheme[theme]?.raw ?? t.raw
    const resolve = (t, stack) => {
      if (resolved.has(t.path)) return resolved.get(t.path)
      if (stack.includes(t.path))
        throw new Error(`reference cycle (${theme}): ${[...stack, t.path].join(' → ')}`)
      const value = raw(t).replace(REF, (_, ref) => resolve(byPath.get(ref), [...stack, t.path]))
      resolved.set(t.path, value)
      return value
    }
    return (t) => resolve(t, [])
  }
  const asVar = (raw) => raw.replace(REF, (_, ref) => `var(${byPath.get(ref).cssName})`)
  const resolvers = new Map(themes.map((theme) => [theme.name, resolver(theme.name)]))
  for (const t of tokens) {
    t.value = asVar(t.raw)
    t.resolved = resolvers.get(base.name)(t)
    for (const theme of others) {
      const own = t.byTheme[theme.name]
      t.byTheme[theme.name] = {
        raw: own?.raw ?? null,
        references: own?.references ?? [],
        value: own ? asVar(own.raw) : null,
        resolved: resolvers.get(theme.name)(t),
      }
    }
  }
  return Object.assign(tokens, { groups, themes })
}

function renderCss(tokens) {
  const [base, ...others] = tokens.themes
  const lines = [
    `/* GENERATED — do not edit; source ${SOURCE}; run \`pnpm tokens\` */`,
    '',
    '/* primitive — screen CSS never uses these directly; semantic tokens reference them (dark steps included) */',
    ':root {',
  ]
  for (const t of tokens.filter((t) => t.layer === 'primitive'))
    lines.push(`  ${t.cssName}: ${t.value};`)
  /** 묶음마다 제목 주석 + 줄 — pick 이 null 인 토큰(그 테마 값 없음)은 건너뛴다 */
  const groupBlock = (pick, indent, layer = 'semantic') => {
    let first = true
    for (const g of tokens.groups.filter((g) => g.path.startsWith(`${layer}.`))) {
      const rows = tokens.filter((t) => t.group === g.path && pick(t) !== null)
      if (!rows.length) continue
      if (!first) lines.push('')
      first = false
      lines.push(`${indent}/* ${g.title} */`)
      for (const t of rows) lines.push(`${indent}${t.cssName}: ${pick(t)};`)
    }
  }
  lines.push(
    '}',
    '',
    `/* semantic — the names screen CSS uses. ${base.title} (default): data-theme absent or "${base.name}".`,
    "   A theme attribute works on any element — a container can show a theme beside the page's — not only <html>.",
    '   Other theme blocks follow and override with the same specificity */',
    `:root,\n${themeAttr(base.name)} {`,
    `  color-scheme: ${base.colorScheme};`,
    '',
  )
  groupBlock((t) => t.value, '  ')
  lines.push('}')
  const themeBody = (theme, indent) => {
    lines.push(`${indent}color-scheme: ${theme.colorScheme};`, '')
    groupBlock((t) => t.byTheme[theme.name].value, indent)
  }
  for (const theme of others) {
    if (!tokens.some((t) => t.byTheme[theme.name].value !== null)) continue
    lines.push(
      '',
      `/* ${theme.title} — data-theme="${theme.name}" (on <html> or any container) */`,
      `${themeAttr(theme.name)} {`,
    )
    themeBody(theme, '  ')
    lines.push('}')
  }
  const system = others.find((t) => t.system)
  if (system && tokens.some((t) => t.byTheme[system.name].value !== null)) {
    // 다른 테마를 고른 화면(data-theme='<그 이름>')은 OS 가 어두워도 덮지 않는다
    const keep = tokens.themes.filter((t) => t !== system).map((t) => `:not(${themeAttr(t.name)})`)
    lines.push(
      '',
      `/* system — data-theme absent or "system" follows the OS (no reload, CSS only). Same values as the ${system.title} block above */`,
      `@media (prefers-color-scheme: ${system.colorScheme}) {`,
      `  :root${keep.join('')} {`,
    )
    themeBody(system, '    ')
    lines.push('  }', '}')
  }
  if (tokens.some((t) => t.layer === 'component')) {
    // 부품 토큰은 의미 토큰을 참조한다. 사용자 지정 속성의 var() 는 선언된 요소에서 풀려 자식에게 상속되므로,
    // 테마 속성이 달린 컨테이너마다 다시 선언해야 그 안의 부품이 그 테마의 값을 받는다
    lines.push(
      '',
      '/* component — the handles component CSS uses (--<part>-<name>). They reference semantic tokens, so',
      '   every theme follows; re-declared on [data-theme] containers so a themed container re-resolves them */',
      ':root,\n[data-theme] {',
    )
    groupBlock((t) => t.value, '  ', 'component')
    lines.push('}')
  }
  return `${lines.join('\n')}\n`
}

const cell = (text) => text.replace(/\|/g, '\\|').replace(/\n/g, ' ')

function refCell(byPath, raw, value) {
  const single = /^\{([^{}]+)\}$/.exec(raw)
  if (single) return `\`${byPath.get(single[1]).cssName}\``
  return `\`${value}\``
}

function renderDocTables(tokens) {
  const byPath = new Map(tokens.map((t) => [t.path, t]))
  const [base, ...others] = tokens.themes
  const titles = [base, ...others].map((t) => t.title)
  const out = [
    DOC_START,
    `<!-- generated region — do not edit by hand. source ${SOURCE}, run \`pnpm tokens\` -->`,
  ]
  for (const g of tokens.groups) {
    out.push(
      '',
      `### ${g.title}`,
      '',
      `| token | ${titles.join(' | ')} | reference | purpose |`,
      `|---|${titles.map(() => '---|').join('')}---|---|`,
    )
    for (const t of tokens.filter((t) => t.group === g.path)) {
      // 기본과 같으면(크기 · 서체 · 테마 무관 값) 「=」
      const themed = others.map((theme) => {
        const resolved = t.byTheme[theme.name].resolved
        return resolved === t.resolved ? '=' : `\`${cell(resolved)}\``
      })
      const refs = [refCell(byPath, t.raw, t.value)]
      for (const theme of others) {
        const own = t.byTheme[theme.name]
        if (own.raw !== null) refs.push(`${theme.title} ${refCell(byPath, own.raw, own.value)}`)
      }
      out.push(
        `| \`${t.cssName}\` | \`${cell(t.resolved)}\` | ${themed.map((v) => `${v} | `).join('')}${cell(refs.join(' · '))} | ${cell(t.description)} |`,
      )
    }
    if (g.note) out.push('', g.note)
  }
  out.push(
    '',
    '### Primitive palette (`--p-*`)',
    '',
    'Values the semantic tokens reference. Never use these directly in screen CSS or components.',
    '',
    '| token | value | description |',
    '|---|---|---|',
  )
  for (const t of tokens.filter((t) => t.layer === 'primitive'))
    out.push(`| \`${t.cssName}\` | \`${cell(t.value)}\` | ${cell(t.description)} |`)
  out.push(DOC_END)
  return out.join('\n')
}

function renderDoc(doc, tokens, docPath) {
  const start = doc.indexOf(DOC_START)
  const end = doc.indexOf(DOC_END)
  if (start < 0 || end < start)
    throw new Error(`${docPath}: ${DOC_START} … ${DOC_END} markers missing`)
  return doc.slice(0, start) + renderDocTables(tokens) + doc.slice(end + DOC_END.length)
}

/** 경로 옵션 — 모두 root 기준 상대 경로(절대 경로도 된다). docOut 이 null 이면 문서는 만들지도 비교하지도 않는다 */
function resolvePaths({ root = ROOT, source = SOURCE, cssOut = CSS_OUT, docOut = null } = {}) {
  return { root, source, cssOut, docOut }
}

/** 정본에서 생성물 글자를 만든다. write 면 파일에 쓴다(없는 폴더는 만든다). doc 은 docOut 이 있을 때만 */
export function build({ write = true, ...options } = {}) {
  const { root, source, cssOut, docOut } = resolvePaths(options)
  const tokens = resolveTokens(JSON.parse(readFileSync(join(root, source), 'utf8')))
  const css = renderCss(tokens)
  // 문서는 표 구역만 갈아 끼운다 — 손으로 쓴 절이 있어 문서가 없으면 만들 수 없다
  let doc = null
  if (docOut !== null) {
    if (!existsSync(join(root, docOut)))
      throw new Error(
        `${docOut} not found — a doc with the table region (${DOC_START} … ${DOC_END}) is required`,
      )
    doc = renderDoc(readFileSync(join(root, docOut), 'utf8'), tokens, docOut)
  }
  if (write) {
    writeInto(root, cssOut, css)
    if (doc !== null) writeInto(root, docOut, doc)
  }
  return { css, doc, tokens }
}

function writeInto(root, path, text) {
  mkdirSync(dirname(join(root, path)), { recursive: true })
  writeFileSync(join(root, path), text)
}

/** 쓰지 않고 정본에서 다시 만든 결과와 커밋된 생성물을 비교 — 어긋난 파일 경로(root 기준). 없는 생성물도 어긋남이다 */
export function check(options = {}) {
  const { root, cssOut, docOut } = resolvePaths(options)
  const missing = (path) => `${path} (missing)`
  if (docOut !== null && !existsSync(join(root, docOut))) return [missing(docOut)]
  const { css, doc } = build({ ...options, write: false })
  return [[cssOut, css], ...(docOut === null ? [] : [[docOut, doc]])]
    .map(([path, expected]) => {
      if (!existsSync(join(root, path))) return missing(path)
      return readFileSync(join(root, path), 'utf8') === expected ? null : path
    })
    .filter((path) => path !== null)
}

const USAGE = `usage: node build.mjs [--check] [--source <json>] [--css <file>] [--doc <md>]
  (no args)  regenerate ${CSS_OUT} from ${SOURCE}                                    (pnpm tokens)
  --check    compare without writing — exit 1 on drift                              (pnpm tokens:check)
  --source   token source, relative to the package folder   (default ${SOURCE})
  --css      generated stylesheet                           (default ${CSS_OUT})
  --doc      also rewrite the table region (${DOC_START} … ${DOC_END}) of this markdown file; omitted = docs untouched`

const VALUE_FLAGS = { '--source': 'source', '--css': 'cssOut', '--doc': 'docOut' }

/** 명령줄 인자 → { check, help, options } — 모르는 인자 · 값 없는 플래그는 unknown 에 담는다 */
function parseArgs(argv) {
  const parsed = { check: false, help: false, options: {}, unknown: [] }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--check') parsed.check = true
    else if (arg === '--help' || arg === '-h') parsed.help = true
    else if (arg in VALUE_FLAGS) {
      const value = argv[i + 1]
      if (value === undefined || value.startsWith('--')) parsed.unknown.push(arg)
      else {
        parsed.options[VALUE_FLAGS[arg]] = value
        i += 1
      }
    } else parsed.unknown.push(arg)
  }
  return parsed
}

/** 명령줄 — 끝 코드: 0 성공 · 1 어긋남(--check) · 2 모르는 인자(아무것도 쓰지 않는다) */
export function main(argv, { root = ROOT, log = console.log, error = console.error } = {}) {
  const { check: checking, help, options, unknown } = parseArgs(argv)
  if (unknown.length) {
    error(`unknown argument: ${unknown.join(' ')}\n${USAGE}`)
    return 2
  }
  if (help) {
    log(USAGE)
    return 0
  }
  const paths = resolvePaths({ root, ...options })
  const outputs = [paths.cssOut, paths.docOut].filter((path) => path !== null).join(', ')
  if (checking) {
    const drifted = check(paths)
    if (drifted.length) {
      error(
        `tokens: generated files drifted from ${paths.source} — ${drifted.join(', ')}\n` +
          '  do not edit generated files by hand: edit tokens.json, then run `pnpm tokens`',
      )
      return 1
    }
    log(`tokens: generated files match the source (${outputs})`)
    return 0
  }
  const { tokens } = build(paths)
  const count = (layer) => tokens.filter((t) => t.layer === layer).length
  const themed = tokens.themes
    .slice(1)
    .map(
      (theme) => `${theme.name} ${tokens.filter((t) => t.byTheme[theme.name].raw !== null).length}`,
    )
    .join(' · ')
  log(
    `tokens: primitive ${count('primitive')} · semantic ${count('semantic')} (${themed}) · component ${count('component')} → ${outputs}`,
  )
  return 0
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  process.exitCode = main(process.argv.slice(2))
