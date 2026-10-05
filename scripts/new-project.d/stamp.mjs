// scripts/new-project.sh 의 일꾼(node 만 쓴다). 직접 부르지 않는다 — 인자 검증은 셸이 한다.
//   node stamp.mjs plan  <srcRoot> <withWorkbench 0|1> <requestedCsv>            → 남길 패키지(`keep <p>`)와 이유(`why <p> …`)
//   node stamp.mjs copy  <srcRoot> <target>                                       → 군더더기 빼고 복사
//   node stamp.mjs apply <target> <name> <scope> <withWorkbench 0|1> <keepCsv>   → 가지치기 · 이름 · 스코프 · 문서
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  renameSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { basename, join } from 'node:path'

const SCOPE = '@skeleton'
const fail = (message, code = 1) => {
  console.error(`x ${message}`)
  process.exit(code)
}
const read = (path) => readFileSync(path, 'utf8')
const readJson = (path) => JSON.parse(read(path))
const writeJson = (path, value) => writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
const subdirs = (path) =>
  existsSync(path)
    ? readdirSync(path).filter((name) => statSync(join(path, name)).isDirectory())
    : []
const skeletonDeps = (pkg) =>
  ['dependencies', 'devDependencies', 'peerDependencies'].flatMap((field) =>
    Object.keys(pkg[field] ?? {}).filter((dep) => dep.startsWith(`${SCOPE}/`)),
  )
const nameOf = (dep) => dep.slice(SCOPE.length + 1)

// ------------------------------------------------------------------------------------------------ plan
function plan(root, withWorkbench, requested) {
  const packages = subdirs(join(root, 'packages')).filter((dir) =>
    existsSync(join(root, 'packages', dir, 'package.json')),
  )
  const manifest = Object.fromEntries(
    packages.map((dir) => [dir, readJson(join(root, 'packages', dir, 'package.json'))]),
  )
  const reasons = new Map() // 패키지 → 첫 이유
  const queue = []
  const want = (pkg, why) => {
    if (!packages.includes(pkg))
      fail(`unknown package: ${pkg}\nvalid packages: ${packages.join(' ')}`, 3)
    if (reasons.has(pkg)) return
    reasons.set(pkg, why)
    queue.push(pkg)
  }
  for (const dep of skeletonDeps(readJson(join(root, 'apps', 'starter', 'package.json'))))
    want(nameOf(dep), 'needed by the starter app')
  for (const dep of skeletonDeps(readJson(join(root, 'package.json'))))
    want(nameOf(dep), 'needed by the root tooling')
  if (withWorkbench === '1')
    for (const dep of skeletonDeps(readJson(join(root, 'apps', 'workbench', 'package.json'))))
      want(nameOf(dep), 'needed by the workbench app')
  for (const pkg of requested.split(',').filter(Boolean)) want(pkg, 'requested')
  for (let i = 0; i < queue.length; i += 1) {
    const pkg = queue[i]
    for (const dep of skeletonDeps(manifest[pkg])) want(nameOf(dep), `needed by ${pkg}`)
  }
  for (const pkg of [...reasons.keys()].sort()) {
    console.log(`keep ${pkg}`)
    console.log(`why ${pkg} ${reasons.get(pkg)}`)
  }
}

// ------------------------------------------------------------------------------------------------ copy
const SKIP_NAMES = new Set([
  'node_modules',
  'dist',
  'dist-ssr',
  '.git',
  '.claude',
  '.superpowers',
  '.tmp',
  '.idea',
  '.vscode',
  '.DS_Store',
  '.env',
])
function copy(root, target) {
  if (existsSync(target)) fail(`target already exists: ${target}`)
  mkdirSync(target, { recursive: true })
  cpSync(root, target, {
    recursive: true,
    filter: (path) => {
      const name = basename(path)
      return !SKIP_NAMES.has(name) && !name.endsWith('.local') && !name.endsWith('.tsbuildinfo')
    },
  })
}

// ------------------------------------------------------------------------------------------------ apply
const SCOPE_WORD = new RegExp(`${SCOPE}(?![A-Za-z0-9_-])`, 'g') // `@skeleton/x` · `@skeleton\\/x`(정규식 안) · 글 속의 `@skeleton`
const TEXT = /\.(?:[cm]?[jt]sx?|json|css|html|md|ya?ml|sh|svg|txt)$/
function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    if (name === 'node_modules' || name === '.git') return []
    const path = join(dir, name)
    return statSync(path).isDirectory() ? walk(path) : [path]
  })
}

/** 한 번 바꿔서 정말 바뀌었는지 확인한다 — 소스가 바뀌어 규칙이 안 맞으면 조용히 넘어가지 않고 멈춘다 */
function replaceOnce(path, from, to) {
  const text = read(path)
  if (!text.includes(from))
    fail(
      `${path}: expected to find ${JSON.stringify(from)} — the skeleton changed, update scripts/new-project.d/stamp.mjs`,
    )
  writeFileSync(path, text.replace(from, to))
}

function apply(target, name, scope, withWorkbench, keepCsv) {
  const keep = new Set(keepCsv.split(',').filter(Boolean))
  const workbench = withWorkbench === '1'
  const app = join(target, 'apps', name)

  // 1. 가지치기
  for (const pkg of subdirs(join(target, 'packages')))
    if (!keep.has(pkg)) rmSync(join(target, 'packages', pkg), { recursive: true, force: true })
  if (!workbench) rmSync(join(target, 'apps', 'workbench'), { recursive: true, force: true })
  for (const path of [
    'scripts/new-project.sh',
    'scripts/test-new-project.sh',
    'scripts/new-project.d',
    '.github/workflows/new-project.yml',
    'tests/skeleton.repo.test.ts',
  ])
    rmSync(join(target, path), { recursive: true, force: true })
  if (existsSync(join(target, 'scripts')) && readdirSync(join(target, 'scripts')).length === 0)
    rmSync(join(target, 'scripts'), { recursive: true })

  // 2. 앱 이름
  if (name !== 'starter') renameSync(join(target, 'apps', 'starter'), app)
  const appJson = readJson(join(app, 'package.json'))
  writeJson(join(app, 'package.json'), { ...appJson, name, version: '0.1.0' })
  replaceOnce(join(app, 'index.html'), '<title>starter</title>', `<title>${name}</title>`)
  replaceOnce(
    join(app, 'src/layouts/RootLayout.tsx'),
    '<strong>starter</strong>',
    `<strong>${name}</strong>`,
  )
  const envFile = join(app, '.env.example')
  const envLines = read(envFile).split('\n')
  envLines[0] = `# ${name} — ${envLines[0].replace(/^#\s*/, '')}`
  writeFileSync(envFile, envLines.join('\n'))

  // 3. 루트
  const rootFile = join(target, 'package.json')
  const root = readJson(rootFile)
  root.name = `${name}-workspace`
  root.version = '0.1.0'
  root.scripts.dev = `pnpm --filter ${name} dev`
  if (!workbench) delete root.scripts['dev:workbench']
  root.scripts.test = root.scripts.test.replace(
    /\s*&&\s*bash scripts\/test-new-project\.sh[^&]*/,
    '',
  )
  if (/new-project/.test(JSON.stringify(root.scripts)))
    fail('the root scripts still mention new-project after stripping — update stamp.mjs')
  writeJson(rootFile, root)
  const group =
    name === 'starter'
      ? "'workbench', 'workbench/**', 'starter', 'starter/**'"
      : `'workbench', 'workbench/**', 'starter', 'starter/**', '${name}', '${name}/**'`
  replaceOnce(
    join(target, 'eslint.config.js'),
    "'workbench', 'workbench/**', 'starter', 'starter/**'",
    group,
  )

  // 4. 스코프 — 모든 텍스트 파일(문서는 아래에서 다시 쓴다)
  if (scope !== SCOPE)
    for (const path of walk(target)) {
      if (!TEXT.test(path) || basename(path) === 'pnpm-lock.yaml') continue
      const text = read(path)
      const next = text.replace(SCOPE_WORD, scope)
      if (next !== text) writeFileSync(path, next)
    }

  // 5. 문서 다시 쓰기
  writeDocs(target, name, scope, workbench)
}

function writeDocs(target, name, scope, workbench) {
  const source = readJson(join(target, 'package.json'))
  const pkgs = subdirs(join(target, 'packages')).map((dir) => ({
    dir,
    ...readJson(join(target, 'packages', dir, 'package.json')),
  }))
  const row = (p) =>
    `| \`${p.name}\` | ${(p.description ?? '').replace(/\|/g, '\\|')} | \`packages/${p.dir}/README.md\` |`
  const table = `| 패키지 | 설명 | 자세히 |\n|---|---|---|\n${pkgs.map(row).join('\n')}`
  const from = readJson(join(target, 'apps', name, 'package.json'))
  const used = new Set(
    Object.keys(from.dependencies ?? {}).filter((d) => d.startsWith(`${scope}/`)),
  )
  const unused = pkgs.filter((p) => !used.has(p.name)).map((p) => p.name)

  writeFileSync(
    join(target, 'README.md'),
    `# ${name}

react-skeleton(pnpm 워크스페이스)에서 \`scripts/new-project.sh\` 로 찍어 낸 프로젝트. 앱은 \`apps/${name}\`${workbench ? ' · 백엔드 확인용 \`apps/workbench\`' : ''}, 패키지는 \`packages/*\`(스코프 \`${scope}\`).

## 시작

\`\`\`bash
pnpm install --no-frozen-lockfile   # 처음 한 번 — pnpm-lock.yaml 이 이 워크스페이스에 맞춰진다. 결과를 커밋한다
pnpm format                          # 처음 한 번 — 이름 · 스코프 바꾸기로 달라진 줄바꿈
pnpm dev                             # apps/${name}  http://localhost:5173 (백엔드 :8080 으로 /api/v1 프록시)
pnpm lint && pnpm typecheck && pnpm test && pnpm format:check && pnpm build
pnpm tokens                          # packages/tokens/tokens.json → tokens.css
\`\`\`

Node 24(또는 22.18+), pnpm 10.

## 패키지

${table}

패키지는 **내부를 고치지 않는다** — 바꾸고 싶은 것은 설정 · prop · \`tokens.json\` 값으로 바꾼다. 서로는 이름(\`${scope}/<이름>\`)으로만 부른다(ESLint · \`pnpm test\` 가 막는다).
${unused.length ? `\n폴더는 있지만 앱이 아직 쓰지 않는 패키지: ${unused.map((n) => `\`${n}\``).join(' · ')}. 쓰기 시작할 때 \`apps/${name}/package.json\` 에 한 줄 — \`"${scope}/<이름>": "workspace:*"\` — 을 더하고 \`pnpm install\`. 안 쓰는 패키지를 의존으로 선언하면 \`pnpm test\` 가 막고, 필요 없으면 \`packages/<이름>\` 폴더를 지운다.\n` : ''}
## 백엔드

kotlin-skeleton 계열 REST 백엔드(\`/api/v1\`)와 통신한다. 개발에서는 Vite 가 \`/api/v1\` 을 \`http://localhost:8080\` 으로 프록시하고, 다른 포트는 앱 폴더 \`.env\` 의 \`VITE_API_BASE_URL\`. 패키지별로 어느 백엔드 모듈과 짝인지는 각 \`packages/<이름>/README.md\`.
`,
  )

  const original = existsSync(join(target, 'CLAUDE.md')) ? read(join(target, 'CLAUDE.md')) : ''
  const at = original.indexOf('## 핵심 컨벤션')
  if (at < 0) fail('CLAUDE.md has no "## 핵심 컨벤션" section — update stamp.mjs')
  const structure = [
    `apps/`,
    `└── ${name}/        # 앱 — 라우터 · AppShell · API 클라이언트 배선 · 보호 라우트 (starter 에서 이름만 바뀌었다)`,
    ...(workbench ? ['└── workbench/     # 백엔드 확인용 시각적 테스트 벤치(복사 대상 아님)'] : []),
    `packages/`,
    ...pkgs.map((p) => `├── ${p.dir.padEnd(18)}# ${p.description ?? ''}`),
  ].join('\n')
  writeFileSync(
    join(target, 'CLAUDE.md'),
    `# ${name} — Claude Code 컨텍스트

react-skeleton 에서 찍어 낸 pnpm 워크스페이스(React + TypeScript + Vite). 앱 \`apps/${name}\`, 패키지 ${pkgs.length}개(스코프 \`${scope}\`).

## 디렉토리 구조 (AI 참조용)

\`\`\`
${structure}
tests/            # 워크스페이스 가로지르는 테스트: usage · contrast · tokens.wiring · theme.names · workspace(의존 규칙) · eslint.boundaries
docs/design-tokens.md
\`\`\`

${original.slice(at).replace(SCOPE_WORD, scope).replaceAll('apps/starter', `apps/${name}`)}`,
  )

  writeFileSync(
    join(target, 'CHANGELOG.md'),
    `# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- react-skeleton ${readJson(join(target, 'packages', 'tokens', 'package.json')).version} 에서 \`scripts/new-project.sh\` 로 시작 — 앱 \`apps/${name}\`, 패키지 ${pkgs.map((p) => p.dir).join(' · ')}
`,
  )
  void source
}

const [command, ...args] = process.argv.slice(2)
if (command === 'plan') plan(...args)
else if (command === 'copy') copy(...args)
else if (command === 'apply') apply(...args)
else fail(`usage: stamp.mjs plan|copy|apply …`, 2)
