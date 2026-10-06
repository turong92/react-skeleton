// scripts/new-project.sh 의 일꾼(node 만 쓴다). 직접 부르지 않는다 — 인자 검증은 셸이 한다.
//   node stamp.mjs plan  <srcRoot> <withWorkbench 0|1> <requestedCsv> [ssr 0|1] [withSample 0|1]                                 → 남길 패키지(`keep <p>`)와 이유(`why <p> …`)
//   node stamp.mjs copy  <srcRoot> <target>                                                                      → 군더더기 빼고 복사
//   node stamp.mjs apply <target> <name> <scope> <withWorkbench 0|1> <keepCsv> [ssr 0|1] [withStorybook 0|1] [withSample 0|1] → 가지치기 · 이름 · 스코프 · 문서
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
import { projectCatalog } from '../capabilities.d/project.mjs'
import { renderCapabilitiesMd, renderLlmsTxt } from '../capabilities.d/render.mjs'

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
function plan(root, withWorkbench, requested, ssr = '0', withSample = '0') {
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
  const starter = ssr === '1' ? 'starter-ssr' : 'starter'
  for (const dep of skeletonDeps(readJson(join(root, 'apps', starter, 'package.json'))))
    want(nameOf(dep), `needed by the ${starter} app`)
  for (const dep of skeletonDeps(readJson(join(root, 'package.json'))))
    want(nameOf(dep), 'needed by the root tooling')
  if (withWorkbench === '1')
    for (const dep of skeletonDeps(readJson(join(root, 'apps', 'workbench', 'package.json'))))
      want(nameOf(dep), 'needed by the workbench app')
  if (withSample === '1')
    for (const dep of skeletonDeps(readJson(join(root, 'apps', 'sample', 'package.json'))))
      want(nameOf(dep), 'needed by the sample app')
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
  'storybook-static',
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

// ------------------------------------------------------------------------------------------------ 스토리집
const STORY_FILE = /\.stories\.tsx$/
const STORYBOOK_DEP = /^(?:storybook$|@storybook\/|@vitest\/browser|playwright$)/
const markerBlocks = (text, keep, name) => {
  // `<!-- name:start -->` … `<!-- name:end -->` — keep 이면 표식 줄만 걷고, 아니면 사이를 통째로 뺀다
  const block = new RegExp(
    `[ \\t]*<!-- ${name}:start -->\\n([\\s\\S]*?)[ \\t]*<!-- ${name}:end -->\\n?`,
    'g',
  )
  return text.replace(block, (_, inner) => (keep ? inner : ''))
}

/** 스토리집을 켠 채로 찍을 때: 지운 패키지의 스토리 줄을 카탈로그에서 뺀다 */
function trimCatalog(target) {
  const file = join(target, 'docs', 'ui-catalog.md')
  if (!existsSync(file))
    fail('docs/ui-catalog.md is missing — the skeleton changed, update stamp.mjs')
  const lines = read(file)
    .split('\n')
    .filter((line) => {
      const story = line.match(/`((?:packages|apps)\/[^`\s]+\.stories\.tsx)`/)?.[1]
      return !story || existsSync(join(target, story))
    })
  writeFileSync(file, lines.join('\n'))
}

/** --without-storybook: 스토리집 · 모든 스토리와 가짜 · 도구 의존 · 스크립트 · 전용 테스트 · 카탈로그 · CI 잡을 뗀다 */
function removeStorybook(target) {
  rmSync(join(target, 'apps', 'storybook'), { recursive: true, force: true })
  for (const path of ['tests/stories.test.ts', 'docs/ui-catalog.md'])
    rmSync(join(target, path), { recursive: true, force: true })
  for (const dir of subdirs(join(target, 'packages'))) {
    const root = join(target, 'packages', dir)
    for (const file of walk(root)) if (STORY_FILE.test(file)) rmSync(file)
    rmSync(join(root, 'src', 'stories'), { recursive: true, force: true })
    // 스토리에서만 쓰던 @skeleton/ui devDependency 를 걷는다(다른 소스가 안 쓰면)
    const manifest = join(root, 'package.json')
    const json = readJson(manifest)
    const ui = `${SCOPE}/ui`
    if (json.devDependencies?.[ui] !== undefined) {
      const stillUsed = walk(join(root, 'src')).some(
        (file) => /\.[cm]?[jt]sx?$/.test(file) && read(file).includes(`'${ui}`),
      )
      if (!stillUsed) {
        delete json.devDependencies[ui]
        if (Object.keys(json.devDependencies).length === 0) delete json.devDependencies
        writeJson(manifest, json)
      }
    }
  }
  const rootFile = join(target, 'package.json')
  const root = readJson(rootFile)
  for (const key of ['storybook', 'storybook:build', 'test:stories']) delete root.scripts[key]
  for (const dep of Object.keys(root.devDependencies ?? {}))
    if (STORYBOOK_DEP.test(dep)) delete root.devDependencies[dep]
  writeJson(rootFile, root)
  const ci = join(target, '.github', 'workflows', 'ci.yml')
  const job = /[ \t]*# stories-job:start\n[\s\S]*?[ \t]*# stories-job:end\n?/
  if (!job.test(read(ci)))
    fail(
      'ci.yml has no stories-job block — the skeleton changed, update scripts/new-project.d/stamp.mjs',
    )
  writeFileSync(ci, read(ci).replace(job, ''))
  const eslintFile = join(target, 'eslint.config.js')
  replaceOnce(
    eslintFile,
    "const STORY_HINT = ' — see its story for the canonical usage (docs/ui-catalog.md)'",
    "const STORY_HINT = ''",
  )
  replaceOnce(eslintFile, ", '**/storybook-static'", '')
}

// ------------------------------------------------------------------------------------------------ 샘플
const SAMPLE_SCRIPTS = ['dev:sample', 'e2e:sample']
const SAMPLE_JOB = /[ \t]*# sample-e2e-job:start\n[\s\S]*?[ \t]*# sample-e2e-job:end\n?/
const SAMPLE_JOB_MARKERS = /[ \t]*# sample-e2e-job:(?:start|end)\n/g

/** 샘플을 안 가져가면: 앱 폴더 · 샘플 전용 루트 스크립트 · CI 의 e2e 잡(표식 사이)을 뗀다. 가져가면 표식 줄만 걷는다 */
function stampSample(target, withSample) {
  const rootFile = join(target, 'package.json')
  const root = readJson(rootFile)
  const ci = join(target, '.github', 'workflows', 'ci.yml')
  if (withSample) {
    if (existsSync(ci)) writeFileSync(ci, read(ci).replace(SAMPLE_JOB_MARKERS, ''))
    return
  }
  rmSync(join(target, 'apps', 'sample'), { recursive: true, force: true })
  for (const key of SAMPLE_SCRIPTS) delete root.scripts[key]
  writeJson(rootFile, root)
  if (existsSync(ci)) writeFileSync(ci, read(ci).replace(SAMPLE_JOB, ''))
}

/**
 * --auth-methods: 로그인 방법을 이 목록으로 **고정**한다(`authConfig.ts` 의 `DEFAULT_AUTH_METHODS`) — 앱이 백엔드(`GET /auth/methods`)에 묻지 않고 이 방법만 쓴다.
 * 안 주면 빈 값 = 백엔드가 알려 준 대로. 환경변수 VITE_AUTH_METHODS 가 여전히 이긴다
 */
function applyAuthMethods(app, methods) {
  if (!methods) return
  const file = join(app, 'src', 'auth', 'authConfig.ts')
  if (!existsSync(file))
    fail(
      `--auth-methods: ${file} is missing — the skeleton changed, update scripts/new-project.d/stamp.mjs`,
    )
  const before = read(file)
  const after = before.replace(
    "export const DEFAULT_AUTH_METHODS = ''",
    `export const DEFAULT_AUTH_METHODS = '${methods}'`,
  )
  if (after === before)
    fail(
      '--auth-methods: DEFAULT_AUTH_METHODS was not found in authConfig.ts — the skeleton changed, update scripts/new-project.d/stamp.mjs',
    )
  writeFileSync(file, after)
}

function apply(
  target,
  name,
  scope,
  withWorkbench,
  keepCsv,
  ssrFlag = '0',
  withStorybook = '1',
  withSampleFlag = '0',
) {
  const keep = new Set(keepCsv.split(',').filter(Boolean))
  const workbench = withWorkbench === '1'
  const storybook = withStorybook === '1'
  const ssr = ssrFlag === '1'
  const sample = withSampleFlag === '1'
  const source = ssr ? 'starter-ssr' : 'starter' // 새 앱이 될 스타터
  const app = join(target, 'apps', name)

  // 1. 가지치기
  for (const pkg of subdirs(join(target, 'packages')))
    if (!keep.has(pkg)) rmSync(join(target, 'packages', pkg), { recursive: true, force: true })
  if (!workbench) rmSync(join(target, 'apps', 'workbench'), { recursive: true, force: true })
  stampSample(target, sample)
  if (storybook) trimCatalog(target)
  else removeStorybook(target)
  rmSync(join(target, 'apps', ssr ? 'starter' : 'starter-ssr'), { recursive: true, force: true })
  for (const path of [
    'scripts/new-project.sh',
    'scripts/test-new-project.sh',
    'scripts/new-project.d',
    '.github/workflows/new-project.yml',
    'tests/skeleton.repo.test.ts',
    // 카탈로그 가드 중 스켈레톤 전용(stampFlag = new-project.sh 의 동작 · 레시피 명령) — 스크립트가 없는 프로젝트에는 맞지 않는다
    'tests/capabilities.skeleton.test.ts',
    'scripts/capabilities.d/stampCheck.mjs',
    'scripts/capabilities.d/siblingCheck.mjs', // 옆 레포(kotlin-skeleton)의 카탈로그를 읽는 가드 — 찍힌 프로젝트에는 옆 레포가 없다
    'scripts/capabilities.d/siblingCheck.d.mts',
    'docs/new-project-recipe.md',
  ])
    rmSync(join(target, path), { recursive: true, force: true })
  if (existsSync(join(target, 'scripts')) && readdirSync(join(target, 'scripts')).length === 0)
    rmSync(join(target, 'scripts'), { recursive: true })

  // 2. 앱 이름
  if (name !== source) renameSync(join(target, 'apps', source), app)
  applyAuthMethods(app, process.env.AUTH_METHODS ?? '')
  // 저장 키 · 락 · 채널 이름의 접두어 — 같은 출처에 앱 둘을 올려도 토큰이 섞이지 않게 새 앱 이름으로
  replaceOnce(
    join(app, 'src/auth/authConfig.ts'),
    `AUTH_NAMESPACE = '${source}'`,
    `AUTH_NAMESPACE = '${name}'`,
  )
  const appJson = readJson(join(app, 'package.json'))
  writeJson(join(app, 'package.json'), { ...appJson, name, version: '0.1.0' })
  if (ssr) {
    // 서버 렌더 앱: 이름은 한 줄(src/appName.ts) — 문서 제목 · 헤더 브랜드가 거기서 나온다. 실행 · 배포 문서의 이름도 바꾼다
    replaceOnce(
      join(app, 'src/appName.ts'),
      "export const APP_NAME = 'starter-ssr'",
      `export const APP_NAME = '${name}'`,
    )
    replaceOnce(join(app, 'Dockerfile'), 'ARG APP=starter-ssr', `ARG APP=${name}`)
    for (const file of ['README.md', 'Dockerfile', 'Dockerfile.dockerignore', '.env.example']) {
      const path = join(app, file)
      if (existsSync(path)) writeFileSync(path, read(path).replace(/\bstarter-ssr\b/g, name))
    }
  } else {
    replaceOnce(join(app, 'index.html'), '<title>starter</title>', `<title>${name}</title>`)
    replaceOnce(
      join(app, 'src/layouts/RootLayout.tsx'),
      '<strong>starter</strong>',
      `<strong>${name}</strong>`,
    )
  }
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
  delete root.scripts['dev:ssr'] // 서버 렌더 스타터를 골랐으면 그것이 `dev` 이고, 아니면 앱이 없다
  root.scripts.test = root.scripts.test.replace(
    /\s*&&\s*bash scripts\/test-new-project\.sh[^&]*/,
    '',
  )
  if (/new-project/.test(JSON.stringify(root.scripts)))
    fail('the root scripts still mention new-project after stripping — update stamp.mjs')
  writeJson(rootFile, root)
  // 패키지가 앱을 이름으로 부르지 못하게 막는 목록(eslint.config.js 의 APP_NAMES) — 새 앱 이름을 더한다. 줄바꿈은 `pnpm format` 이 맞춘다
  const SPEC_NAMES = [
    'workbench',
    'storybook-app',
    'starter',
    'starter-ssr',
    ...(sample ? ['sample'] : []),
  ]
  const names = SPEC_NAMES.includes(name) ? SPEC_NAMES : [...SPEC_NAMES, name]
  const eslintFile = join(target, 'eslint.config.js')
  const eslintText = read(eslintFile)
  const appNames = /(const APP_NAMES = \{\s*group: )\[[^\]]*\]/
  if (!appNames.test(eslintText))
    fail(
      'eslint.config.js has no APP_NAMES group — the skeleton changed, update scripts/new-project.d/stamp.mjs',
    )
  writeFileSync(
    eslintFile,
    eslintText.replace(
      appNames,
      (_, head) => `${head}[${names.flatMap((n) => [`'${n}'`, `'${n}/**'`]).join(', ')}]`,
    ),
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
  writeDocs(target, name, scope, { workbench, storybook, ssr, sample })
}

function writeDocs(target, name, scope, { workbench, storybook, ssr, sample }) {
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

react-skeleton(pnpm 워크스페이스)에서 \`scripts/new-project.sh\` 로 찍어 낸 프로젝트. 앱은 \`apps/${name}\`${ssr ? '(서버가 첫 응답을 그리는 서버 렌더 앱)' : ''}${workbench ? ' · 백엔드 확인용 \`apps/workbench\`' : ''}${storybook ? ' · 부품 · 화면 틀 · 토큰을 보고 테스트하는 스토리집 \`apps/storybook\`' : ''}${sample ? ' · 새 기능을 만들 때 보고 따라 하는 참조 앱 \`apps/sample\`(Notes — 백엔드 kotlin-skeleton 의 \`apps/sample\` 과 짝, README 에 화면마다 어느 Pattern 으로 짰는지)' : ''}, 패키지는 \`packages/*\`(스코프 \`${scope}\`).

## 시작

\`\`\`bash
pnpm install --no-frozen-lockfile   # 처음 한 번 — pnpm-lock.yaml 이 이 워크스페이스에 맞춰진다. 결과를 커밋한다
pnpm format                          # 처음 한 번 — 이름 · 스코프 바꾸기로 달라진 줄바꿈
pnpm dev                             # apps/${name}  ${ssr ? 'http://localhost:3000 (Node 서버 + Vite · 서버 렌더가 부르는 백엔드는 API_BASE_URL, 브라우저의 /api/v1 은 :8080 으로 프록시)' : 'http://localhost:5173 (백엔드 :8080 으로 /api/v1 프록시)'}
${storybook ? 'pnpm storybook                       # 스토리집 http://localhost:6006 (백엔드 없이 모든 부품 · Patterns · 토큰)\npnpm test:stories                    # 스토리의 play · 접근성을 진짜 브라우저(headless)에서 — 처음 한 번 `pnpm exec playwright install chromium`\n' : ''}pnpm lint && pnpm typecheck && pnpm test && pnpm format:check && pnpm build
pnpm tokens                          # packages/tokens/tokens.json → tokens.css
${ssr ? `pnpm --filter ${name} build && pnpm --filter ${name} start   # 프로덕션 서버(dist/ 를 낸다) — Dockerfile 은 apps/${name}/Dockerfile\n` : ''}\`\`\`

Node 24(또는 22.18+), pnpm 10.

## 패키지

${table}

패키지는 **내부를 고치지 않는다** — 바꾸고 싶은 것은 설정 · prop · \`tokens.json\` 값으로 바꾼다. 서로는 이름(\`${scope}/<이름>\`)으로만 부른다(ESLint · \`pnpm test\` 가 막는다).
${unused.length ? `\n폴더는 있지만 앱이 아직 쓰지 않는 패키지: ${unused.map((n) => `\`${n}\``).join(' · ')}. 쓰기 시작할 때 \`apps/${name}/package.json\` 에 한 줄 — \`"${scope}/<이름>": "workspace:*"\` — 을 더하고 \`pnpm install\`. 안 쓰는 패키지를 의존으로 선언하면 \`pnpm test\` 가 막고, 필요 없으면 \`packages/<이름>\` 폴더를 지운다.\n` : ''}
## 기능 카탈로그

이 프로젝트에 무엇이 들어 있는지는 \`capabilities.json\`(정본 — 스키마 \`docs/capabilities.schema.json\`) · \`docs/capabilities.md\` · \`llms.txt\` 에 있다 — 스켈레톤의 카탈로그에서 **고른 것만** 걸러 왔고, 여기에 없는 기능은 스켈레톤의 \`capabilities.json\` 에서 찾는다. 폴더가 바뀌면 \`pnpm capabilities\`(생성) · \`pnpm capabilities:check\`(검사).

## 백엔드

kotlin-skeleton 계열 REST 백엔드(\`/api/v1\`)와 통신한다. 개발에서는 Vite 가 \`/api/v1\` 을 \`http://localhost:8080\` 으로 프록시하고, 다른 포트는 앱 폴더 \`.env\` 의 \`VITE_API_BASE_URL\`. 패키지별로 어느 백엔드 모듈과 짝인지는 각 \`packages/<이름>/README.md\`.
${ssr ? `\n## 서버 렌더\n\n\`apps/${name}\` 는 서버가 첫 응답을 그리고 브라우저가 이어받는다(plain Vite SSR — \`server/\` 의 Node 서버 · \`src/entry-server.tsx\` · \`src/entry-client.tsx\`). 자세한 규칙(데이터 · 인증 · 시간 · 배포)은 \`apps/${name}/README.md\`.\n` : ''}`,
  )

  const sourceClaude = existsSync(join(target, 'CLAUDE.md')) ? read(join(target, 'CLAUDE.md')) : ''
  // 에이전트 안내(스토리 먼저 · Patterns 표)는 스켈레톤 CLAUDE.md 의 표식 사이에서 그대로 옮긴다 — 스토리집을 뗀 프로젝트에는 없다
  const guide = sourceClaude.match(
    /<!-- storybook-guide:start -->\n([\s\S]*?)<!-- storybook-guide:end -->/,
  )?.[1]
  if (storybook && !guide) fail('CLAUDE.md has no storybook-guide block — update stamp.mjs')
  const original = markerBlocks(
    markerBlocks(sourceClaude, storybook, 'storybook'),
    sample,
    'sample',
  )
  const at = original.indexOf('## 핵심 컨벤션')
  if (at < 0) fail('CLAUDE.md has no "## 핵심 컨벤션" section — update stamp.mjs')
  const structure = [
    `apps/`,
    ssr
      ? `└── ${name}/        # 서버 렌더 앱 — server/(Node 서버 · 정적 파일 · 상태 코드) · src/entry-server.tsx · src/entry-client.tsx · 라우트별 handle(제목 · 설명 · prefetch) (starter-ssr 에서 이름만 바뀌었다)`
      : `└── ${name}/        # 앱 — 라우터 · AppShell · API 클라이언트 배선 · 보호 라우트 (starter 에서 이름만 바뀌었다)`,
    ...(workbench ? ['└── workbench/     # 백엔드 확인용 시각적 테스트 벤치(복사 대상 아님)'] : []),
    ...(sample
      ? [
          '└── sample/        # 참조 앱(Notes) — 로그인 · 대시보드 · 목록 · 상세 · 폼 · 첨부 · 알림 · 설정. 새 기능은 이 앱의 한 조각을 따라 한다(apps/sample/README.md)',
        ]
      : []),
    ...(storybook
      ? [
          '└── storybook/     # 스토리집 — 설정(.storybook/) · Patterns(복사해서 시작하는 화면 틀) · 토큰 문서. 부품 스토리는 packages/*/src/**/*.stories.tsx',
        ]
      : []),
    `packages/`,
    ...pkgs.map((p) => `├── ${p.dir.padEnd(18)}# ${p.description ?? ''}`),
  ].join('\n')
  writeFileSync(
    join(target, 'CLAUDE.md'),
    `# ${name} — Claude Code 컨텍스트

react-skeleton 에서 찍어 낸 pnpm 워크스페이스(React + TypeScript + Vite). 앱 \`apps/${name}\`, 패키지 ${pkgs.length}개(스코프 \`${scope}\`).

## 만들기 전에 — 기능 카탈로그부터 (에이전트 필독)

무엇이든 새로 만들기 전에 \`llms.txt\` → \`capabilities.json\`(이 프로젝트에 **들어 있는** 기능: 한 줄 요약 · 진입점 · 따라 할 스토리 · 짝 백엔드 · 쓰지 않는 경우 · 한국어/영어 키워드)을 읽고, 이미 있는 패키지 · 부품 · Patterns 를 쓴다. 표 \`docs/capabilities.md\`. 카탈로그에 없는 기능은 이 프로젝트에 없다 — 스켈레톤(\`react-skeleton\`)의 \`capabilities.json\` 에 있는지 먼저 보고 그 패키지 폴더를 가져온다(앱 \`package.json\` 에 \`"${scope}/<이름>": "workspace:*"\` 한 줄). 패키지 · 앱을 더하거나 지우면 \`capabilities.json\` 항목을 함께 고치고 \`pnpm capabilities\`(\`tests/capabilities.test.ts\` 가 어긋남을 막는다).
${storybook ? `\n${guide}` : ''}
## 디렉토리 구조 (AI 참조용)

\`\`\`
${structure}
tests/            # 워크스페이스 가로지르는 테스트: ${storybook ? 'stories(모든 부품에 스토리 + play · 카탈로그 일치) · ' : ''}eslint.uiOnly(날 요소 · 인라인 날값 금지) · usage · contrast · tokens.wiring · theme.names · workspace(의존 규칙) · eslint.boundaries
docs/design-tokens.md${storybook ? '\ndocs/ui-catalog.md   # 부품 → 스토리 → 언제 쓰는가' : ''}
\`\`\`

${ssr ? ssrRules(name) : ''}${original
      .slice(at)
      .replace(SCOPE_WORD, scope)
      .replace(/apps\/starter(?![\w-])/g, `apps/${name}`)}`,
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
  // 카탈로그: 스켈레톤의 것에서 고른 것만 — JSON(정본) · 표(docs/capabilities.md) · 색인(llms.txt)
  const catalogFile = join(target, 'capabilities.json')
  if (existsSync(catalogFile)) {
    const filtered = projectCatalog(readJson(catalogFile), {
      root: target,
      projectName: name,
      appFrom: ssr ? 'starter-ssr' : 'starter',
      appTo: name,
      scope,
    })
    writeJson(catalogFile, filtered)
    writeFileSync(join(target, 'docs', 'capabilities.md'), renderCapabilitiesMd(filtered))
    writeFileSync(join(target, 'llms.txt'), renderLlmsTxt(filtered))
  }
  void source
}

/** 서버 렌더 앱을 고른 프로젝트의 CLAUDE.md 에 들어가는 규칙 — 스켈레톤의 CLAUDE.md 는 이 절을 앱 이름과 함께 따로 가진다 */
function ssrRules(name) {
  return `## 서버 렌더 앱 규칙 (apps/${name})

- 서버는 첫 응답만 그린다(\`renderToString\` — 데이터를 \`prefetch\` 로 미리 가져온 뒤). 라우트의 \`handle\`(\`src/routes/routes.tsx\`)에 제목 · 설명을 꼭 적고, 첫 그림에 필요한 데이터는 \`prefetch\`. 브라우저 쪽 진입점은 \`src/entry-client.tsx\`, 서버 쪽은 \`src/entry-server.tsx\`
- 렌더 중에 \`window\` · \`document\` · \`localStorage\` 를 읽지 않는다(effect · 이벤트 핸들러 안에서만). 시각 · 난수 · 브라우저 시간대에 따라 달라지는 글자는 서버 HTML 과 브라우저 첫 그림이 어긋난다 — 하이드레이션 뒤(effect)에 그리거나 시간대 · 로케일을 명시한다
- 모듈 전역 클라이언트 · 세션 · 캐시를 쓰지 않는다 — \`useApi()\`(요청마다 / 앱마다 만든 클라이언트)와 \`createClientApp\`. 토큰은 브라우저에만 있다(\`createDeferredTokens\` — 하이드레이션 뒤에 복원). 로그인해야 보이는 라우트는 \`ClientRequireAuth\` 아래
- 서버가 부르는 백엔드는 \`API_BASE_URL\`(절대 주소), 기다리는 시간은 \`SSR_API_TIMEOUT_MS\`. 실패하면 데이터 없이 200 으로 그리고 브라우저가 다시 부른다
- \`src/hydration.test.tsx\`(서버 HTML = 브라우저 첫 그림)와 \`server/server.integration.test.ts\`(빌드한 서버를 띄워 JS 없이 요청)가 막는다

`
}

const [command, ...args] = process.argv.slice(2)
if (command === 'plan') plan(...args)
else if (command === 'copy') copy(...args)
else if (command === 'apply') apply(...args)
else fail(`usage: stamp.mjs plan|copy|apply …`, 2)
