// capabilities.json → docs/capabilities.md · llms.txt. 같은 입력에는 항상 같은 글자를 낸다(생성 가드가 비교한다).
import { fragmentFor } from './fragment.mjs'

const KIND_TITLE = {
  package: '패키지 (`packages/*`)',
  app: '앱 (`apps/*`)',
  pattern: '패턴 (패키지 안의 한 기능 · 화면 틀)',
  script: '스크립트 (`scripts/*`)',
}
const KINDS = Object.keys(KIND_TITLE)
const cell = (value) => String(value).replace(/\|/g, '\\|').replace(/\n/g, ' ')
const code = (value) => `\`${value}\``
const list = (items, wrap = code) => items.map(wrap).join(' · ')
const GENERATED =
  '<!-- 생성물 — capabilities.json 에서 `pnpm capabilities` 가 만든다. 손으로 고치지 않는다 -->'

const flagText = (e) => {
  const { flag, included, optOut, autoIncludes = [], alsoVia = [] } = e.stampFlag
  const parts = []
  if (included === 'always') parts.push('모든 프로젝트에 들어간다')
  else if (included === 'default')
    parts.push(`기본으로 들어간다${optOut ? ` (빼려면 ${code(optOut)})` : ''}`)
  else if (included === 'never') parts.push('찍은 프로젝트에는 따라가지 않는다(스켈레톤 도구)')
  else if (included === 'selected') parts.push('이 프로젝트를 찍을 때 골라 들어 있다')
  else if (flag) parts.push(code(flag))
  if (autoIncludes.length) parts.push(`함께 따라오는 패키지 ${list(autoIncludes)}`)
  if (alsoVia.length) parts.push(`${list(alsoVia)} 로도 따라온다`)
  return parts.join(' — ')
}

const backendText = (e) => {
  const b = e.backend
  if (!b) return '없음(프런트만)'
  const parts = []
  if (b.modules.length) parts.push(`모듈 ${list(b.modules)}`)
  for (const group of b.oneOfModules ?? [])
    parts.push(`${list(group, code).replace(/ · /g, ' | ')} 중 하나 이상`)
  if ((b.optionalModules ?? []).length) parts.push(`있으면 더 켜지는 ${list(b.optionalModules)}`)
  parts.push(
    b.basePaths.length ? `경로 ${list(b.basePaths)}` : 'HTTP 를 열지 않는다(앱이 컨트롤러를 둔다)',
  )
  if (b.app) parts.push(`짝 앱 ${code(b.app)}`)
  return parts.join(' · ')
}

const kw = (e, n = 99) =>
  `${e.keywords.ko.slice(0, n).join(', ')} / ${e.keywords.en.slice(0, n).join(', ')}`
const shortFlag = (e) =>
  e.stampFlag.flag ??
  { always: '항상', default: '기본', never: '—', selected: '선택됨', flag: '—' }[
    e.stampFlag.included
  ]

function table(entries) {
  return [
    '| id | 무엇을 주는가 | 켜는 법 | 백엔드 | 상태 | 키워드 (ko / en) |',
    '|---|---|---|---|---|---|',
    ...entries.map(
      (e) =>
        `| ${code(e.id)} | ${cell(e.summary)} | ${cell(shortFlag(e))} | ${cell(e.backend ? e.backend.modules.join(', ') || '(경로만)' : '—')} | ${e.status} | ${cell(kw(e, 6))} |`,
    ),
  ].join('\n')
}

function detail(e) {
  const lines = [`### ${code(e.id)} — ${e.summary}`, '']
  lines.push(`- 종류 · 상태: ${e.kind} · ${e.status}`)
  lines.push(`- 위치: ${e.package ? `${code(e.package)} ` : ''}(${code(e.path)})`)
  lines.push(`- 켜는 법: ${flagText(e)}`)
  if (e.needs.length) lines.push(`- 필요한 것: ${list(e.needs)}`)
  lines.push(`- 백엔드: ${backendText(e)}`)
  if (e.entryPoints.length) lines.push(`- 주요 진입점: ${list(e.entryPoints)}`)
  if (e.stories.length) lines.push(`- 보고 따라 할 스토리: ${list(e.stories)}`)
  if (e.patterns.length) lines.push(`- 복사해 시작할 Patterns: ${list(e.patterns)}`)
  if (e.docs.length) lines.push(`- 문서: ${list(e.docs)}`)
  lines.push(`- 쓰지 않는 경우: ${e.notFor.join(' / ')}`)
  lines.push(`- 키워드: ${kw(e)}`)
  return lines.join('\n')
}

function decisionTable(catalog) {
  const rows = (catalog.decisions ?? []).map((d) => {
    const f = fragmentFor(catalog, d.capabilities)
    const pick = d.capabilities.map((id) => code(id)).join(' + ')
    const react = f.react ? code(f.react) : '(기본 포함 — 덧붙일 것 없음)'
    const choice = f.choices.map((g) => `${g.map(code).join(' | ')} 중 고른다`).join('; ')
    const kotlin = [f.kotlin ? code(f.kotlin) : '(모듈 없음)', choice].filter(Boolean).join(' — ')
    return `| ${cell(d.need)} | ${pick} | ${cell(react)} | ${cell(kotlin)} | ${cell(d.byHand)} |`
  })
  return [
    '| 필요한 것 | 고를 것(id) | react `new-project.sh` 조각 | kotlin `new-project.sh` 조각 | 그래도 손으로 써야 하는 것 |',
    '|---|---|---|---|---|',
    ...rows,
  ].join('\n')
}

function interfaces(catalog) {
  const n = catalog.newProject
  if (!n) return []
  return [
    `- react: ${code(n.react.usage)}`,
    `- kotlin: ${code(n.kotlin.usage)}`,
    '- 조각을 합치는 법: `--packages` 는 하나로 합치고(쉼표), 다른 옵션(`--ssr` · `--with-sample` · `--scope` …)은 그대로 덧붙인다. 의존으로 닫히는 패키지는 적지 않아도 따라온다.',
  ]
}

export function renderCapabilitiesMd(catalog) {
  const project = catalog.mode === 'project'
  const out = [GENERATED, '', `# 기능 카탈로그 — ${catalog.name}`, '', catalog.summary, '']
  out.push(
    '정본은 `capabilities.json`(스키마 `docs/capabilities.schema.json`)이고 이 문서 · `llms.txt` 는 거기서 만든다. 항목마다 한 줄 요약 · 켜는 법 · 짝 백엔드 · 진입점 · 따라 할 스토리 · 쓰지 않는 경우 · 한국어/영어 키워드가 있다.',
    '',
  )
  if (project) {
    out.push(
      `이 프로젝트는 ${code(catalog.skeleton.name)} ${catalog.skeleton.version} 에서 찍혔다. 아래는 **이 프로젝트에 들어 있는 것**뿐이다 — 여기에 없는 기능은 스켈레톤에서 찾는다: ${catalog.skeleton.pointer}`,
      '',
    )
  } else {
    out.push(
      '## 읽는 법',
      '',
      '- **무엇이 필요하다는 말을 받으면** 아래 결정표에서 그 말(키워드)을 찾아 id · 명령 조각을 고른다. 표에 없으면 「전체 목록」의 키워드 열을 훑는다. 만들기 전에 이미 있는지 먼저 본다.',
      '- 명령 조각은 카탈로그의 `stampFlag` · `backend` 에서 계산한 것이다. 한 줄로 합치는 완성된 예는 `docs/new-project-recipe.md`.',
      '',
    )
    if (catalog.newProject) out.push('## new-project.sh 인터페이스', '', ...interfaces(catalog), '')
    if ((catalog.decisions ?? []).length)
      out.push('## 필요한 것 → 고를 것', '', decisionTable(catalog), '')
  }
  out.push('## 전체 목록', '')
  for (const kind of KINDS) {
    const entries = catalog.capabilities.filter((e) => e.kind === kind)
    if (entries.length) out.push(`### ${KIND_TITLE[kind]}`, '', table(entries), '')
  }
  out.push('## 항목 상세', '')
  for (const kind of KINDS)
    for (const e of catalog.capabilities.filter((x) => x.kind === kind)) out.push(detail(e), '')
  if (project) {
    out.push('## 여기에 없는 것 (스켈레톤에는 있다)', '')
    if ((catalog.omitted ?? []).length)
      out.push(
        ...catalog.omitted.map(
          (o) =>
            `- ${code(o.id)} (${o.kind}${o.stampFlag ? `, ${o.stampFlag}` : ''}) — ${o.summary}`,
        ),
      )
    else out.push('- (없다 — 스켈레톤의 모든 항목이 들어 있다)')
    out.push(
      '',
      `찾을 때: 스켈레톤의 \`capabilities.json\` 키워드를 본다. 패키지를 이 프로젝트로 가져오려면 스켈레톤의 \`packages/<이름>\` 폴더를 복사하고(의존으로 닫힌 패키지도 함께) 앱 \`package.json\` 에 \`"${catalog.scope}/<이름>": "workspace:*"\` 한 줄을 더한다.`,
      '',
    )
  }
  return `${out.join('\n').trimEnd()}\n`
}

export function renderLlmsTxt(catalog) {
  const project = catalog.mode === 'project'
  const out = [`# ${catalog.name}`, '', `> ${catalog.summary}`, '']
  out.push(
    project
      ? '이 프로젝트에 무엇이 들어 있는지는 아래 카탈로그가 정본이다. 무엇이든 새로 만들기 전에 먼저 읽고, 이미 있는 패키지 · 부품 · Patterns 를 쓴다.'
      : '새 프로젝트를 시킬 때 에이전트는 무엇이든 새로 만들기 전에 아래를 먼저 읽는다 — 이미 준비된 패키지 · 부품 · 화면 틀을 다시 만들지 않기 위해서다.',
    '',
    '## 먼저 읽을 것',
    '',
    '- [capabilities.json](capabilities.json): 기능 카탈로그 정본(id · 요약 · 켜는 법 · 짝 백엔드 · 진입점 · 쓰지 않는 경우 · 한국어/영어 키워드)',
    `- [docs/capabilities.md](docs/capabilities.md): ${project ? '이 프로젝트에 있는 것의 표와 상세, 없는 것의 목록' : '「필요한 것 → 고를 것」 결정표(명령 조각 포함)와 전체 목록'}`,
    ...(catalog.guides ?? []).map((g) => `- [${g.path}](${g.path}): ${g.summary}`),
    '- [CLAUDE.md](CLAUDE.md): 에이전트 규칙(스토리가 정본 · 날 요소 금지 · 토큰 · 경계)',
    '',
  )
  if (project && catalog.skeleton)
    out.push(
      '## 여기에 없는 기능',
      '',
      `- ${catalog.skeleton.pointer} (스켈레톤 ${catalog.skeleton.name} ${catalog.skeleton.version})`,
      '',
    )
  out.push('## 기능 한눈에 (id — 켜는 법: 요약 [키워드])', '')
  for (const kind of KINDS)
    for (const e of catalog.capabilities.filter((x) => x.kind === kind))
      out.push(
        `- ${e.id}${project ? '' : ` (${shortFlag(e)})`}: ${e.summary} [${e.keywords.ko.slice(0, 4).join(', ')}; ${e.keywords.en.slice(0, 3).join(', ')}]`,
      )
  out.push('')
  return out.join('\n')
}
