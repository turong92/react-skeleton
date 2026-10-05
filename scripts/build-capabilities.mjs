// capabilities.json → docs/capabilities.md · llms.txt 생성, 그리고 카탈로그가 레포의 실제와 맞는지 검사한다.
//   node scripts/build-capabilities.mjs           # 생성물을 쓰고 가드를 돌린다  (pnpm capabilities)
//   node scripts/build-capabilities.mjs --check   # 쓰지 않고 어긋나면 종료 코드 1  (pnpm capabilities:check — CI, tokens:check 처럼)
// 가드 목록과 이유는 scripts/capabilities.d/lib.mjs · stampCheck.mjs, 테스트는 tests/capabilities*.test.ts.
import { existsSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  checkCatalog,
  checkSchema,
  GENERATED,
  loadCatalog,
  loadSchema,
} from './capabilities.d/lib.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const check = process.argv.includes('--check')
const catalog = loadCatalog(root)

const schemaProblems = checkSchema(catalog, loadSchema(root))
if (schemaProblems.length) fail(schemaProblems)

if (!check)
  for (const [file, render] of GENERATED) {
    writeFileSync(join(root, file), render(catalog))
    console.log(`wrote ${file}`)
  }

const problems = checkCatalog(root)
// 스켈레톤 전용 가드 — 찍힌 프로젝트에는 new-project.sh 도 이 파일도 없다
if (
  existsSync(join(root, 'scripts/new-project.sh')) &&
  existsSync(join(root, 'scripts/capabilities.d/stampCheck.mjs'))
) {
  const { checkStampFlags, checkDecisions, checkRecipe } =
    await import('./capabilities.d/stampCheck.mjs')
  problems.push(
    ...checkStampFlags(catalog, root),
    ...checkDecisions(catalog, root),
    ...checkRecipe(catalog, root),
  )
}
if (problems.length) fail(problems)
console.log(
  `capabilities ok — ${catalog.capabilities.length} entries${check ? ' (generated docs up to date)' : ''}`,
)

function fail(list) {
  console.error(`capabilities: ${list.length} problem(s)\n`)
  for (const p of list) console.error(`  - ${p.replace(/\n/g, '\n    ')}`)
  process.exit(1)
}
