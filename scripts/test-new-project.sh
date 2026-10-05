#!/usr/bin/env bash
# scripts/new-project.sh 의 테스트.
#
#   scripts/test-new-project.sh            # 빠른 검사 (기본, 수 초): 인자 검증 · 패키지 닫힘 · 구조 · 이름/스코프 바꾸기 · 남는 흔적
#   scripts/test-new-project.sh --quick    # 위와 같다 (`pnpm test` 가 부른다)
#   scripts/test-new-project.sh --full     # 위 + 세 조합을 임시 디렉토리에 찍어 각각 pnpm install · lint · typecheck · test · build (네트워크 필요, 순차, 수 분)
#
# --full 은 CI 의 별도 워크플로(.github/workflows/new-project.yml)가 돈다. 조합:
#   1. 기본값만
#   2. --packages realtime,notifications,storage
#   3. --scope @acme --packages payment
# macOS bash 3.2 와 GNU bash 에서 돈다. 임시 디렉토리는 끝나면 지운다 (KEEP=1 이면 남긴다).
set -euo pipefail

MODE="${1:---quick}"
case "$MODE" in --quick|--full) ;; *) echo "usage: $0 [--quick|--full]" >&2; exit 2 ;; esac

SRC="$(cd "$(dirname "$0")/.." && pwd)"
SCRIPT="$SRC/scripts/new-project.sh"
HELPER="$SRC/scripts/new-project.d/stamp.mjs"
TMP="$(mktemp -d "${TMPDIR:-/tmp}/new-project-test.XXXXXX")"
trap '[ "${KEEP:-0}" = 1 ] || rm -rf "$TMP"' EXIT

FAILURES=0
pass() { echo "  ok   $1"; }
fail() { echo "  FAIL $1"; FAILURES=$((FAILURES + 1)); }
check() { # check "<설명>" <명령...>  — 명령이 성공하면 통과
  local what="$1"; shift
  if "$@" >/dev/null 2>&1; then pass "$what"; else fail "$what"; fi
}
LAST_OUTPUT=""
expect_exit() { # expect_exit <기대 종료코드> "<설명>" <명령...>
  local want="$1" what="$2"; shift 2
  local got=0
  LAST_OUTPUT="$("$@" 2>&1)" || got=$?
  if [ "$got" = "$want" ]; then pass "$what (exit $got)"; else fail "$what — exit $got, expected $want: $(echo "$LAST_OUTPUT" | head -3)"; fi
}
json() { # json <package.json> <js 식 — p 가 파싱된 객체>
  node -e "const p = JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8')); console.log($2)" "$1"
}
listing() { ls "$1" | sort | tr '\n' ' ' | sed 's/ $//'; }

stamp() { # stamp <dir> <옵션...> — 항상 같은 이름으로 찍는다
  local dir="$1"; shift
  bash "$SCRIPT" "$dir" acme-app "$@"
}

# 선언한 @scope 의존이 모두 이 워크스페이스에 있는 패키지를 가리키는지 — 지운 패키지를 가리키는 줄이 남지 않았는지
dangling_deps() { # dangling_deps <project-dir> <scope>  → 남는 줄(없으면 빈 출력)
  [ -f "$1/package.json" ] || { echo "no project at $1"; return; }
  node -e '
    const fs = require("fs"), path = require("path")
    const [root, scope] = process.argv.slice(1)
    const names = new Set()
    const manifests = []
    for (const group of ["apps", "packages"]) {
      if (!fs.existsSync(path.join(root, group))) continue
      for (const dir of fs.readdirSync(path.join(root, group))) {
        const file = path.join(root, group, dir, "package.json")
        if (fs.existsSync(file)) { const p = JSON.parse(fs.readFileSync(file, "utf8")); names.add(p.name); manifests.push([file, p]) }
      }
    }
    manifests.push([path.join(root, "package.json"), JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"))])
    for (const [file, p] of manifests)
      for (const field of ["dependencies", "devDependencies", "peerDependencies"])
        for (const dep of Object.keys(p[field] || {}))
          if (dep.startsWith(scope + "/") && !names.has(dep)) console.log(file + " -> " + dep)
  ' "$1" "$2"
}

echo "== 1. 인자 검증"
expect_exit 2 "인자 없이 부르면 사용법과 함께 exit 2" bash "$SCRIPT"
expect_exit 2 "없는 패키지는 exit 2" bash "$SCRIPT" "$TMP/x1" acme-app --packages no-such-package
echo "$LAST_OUTPUT" | grep -q "notifications" && pass "없는 패키지 오류가 유효한 패키지 목록을 보여 준다" || fail "유효한 패키지 목록이 없다: $LAST_OUTPUT"
[ ! -e "$TMP/x1" ] && pass "검증 실패는 아무것도 만들지 않는다" || fail "검증 실패인데 $TMP/x1 이 생겼다"
mkdir "$TMP/exists"
expect_exit 2 "대상 디렉토리가 이미 있으면 exit 2" bash "$SCRIPT" "$TMP/exists" acme-app
expect_exit 2 "이름은 소문자 · 숫자 · 하이픈" bash "$SCRIPT" "$TMP/x2" "Acme App"
expect_exit 2 "이름 workbench 는 예약 (apps/workbench 와 겹친다)" bash "$SCRIPT" "$TMP/x3" workbench
expect_exit 2 "--scope 는 @이름 꼴" bash "$SCRIPT" "$TMP/x4" acme-app --scope acme
expect_exit 2 "알 수 없는 옵션은 exit 2" bash "$SCRIPT" "$TMP/x5" acme-app --nope
expect_exit 2 "--packages 값이 없으면 exit 2" bash "$SCRIPT" "$TMP/x6" acme-app --packages
expect_exit 2 "대상이 소스 레포 안이면 exit 2" bash "$SCRIPT" "$SRC/stamped-inside" acme-app
[ ! -e "$SRC/stamped-inside" ] && pass "레포 안에는 아무것도 만들지 않는다" || { fail "레포 안에 만들었다"; rm -rf "$SRC/stamped-inside"; }
expect_exit 0 "--help 는 사용법과 exit 0" bash "$SCRIPT" --help

echo "== 2. 패키지 닫힘 (가짜 워크스페이스로 plan)"
FAKE="$TMP/fake"
mkdir -p "$FAKE/apps/starter" "$FAKE/packages/a" "$FAKE/packages/b" "$FAKE/packages/c" "$FAKE/packages/d" "$FAKE/packages/tokens" "$FAKE/packages/theme" "$FAKE/packages/e"
echo '{"name":"root","devDependencies":{"@skeleton/tokens":"workspace:*","@skeleton/theme":"workspace:*"}}' > "$FAKE/package.json"
echo '{"name":"starter","dependencies":{"@skeleton/a":"workspace:*"}}' > "$FAKE/apps/starter/package.json"
echo '{"name":"workbench","dependencies":{"@skeleton/e":"workspace:*"}}' > "$TMP/workbench.json"
echo '{"name":"@skeleton/a","dependencies":{"@skeleton/b":"workspace:*"}}' > "$FAKE/packages/a/package.json"
echo '{"name":"@skeleton/b","dependencies":{"@skeleton/c":"workspace:*"},"peerDependencies":{"react":"^19"}}' > "$FAKE/packages/b/package.json"
echo '{"name":"@skeleton/c"}' > "$FAKE/packages/c/package.json"
echo '{"name":"@skeleton/d","dependencies":{"@skeleton/c":"workspace:*"}}' > "$FAKE/packages/d/package.json"
echo '{"name":"@skeleton/e"}' > "$FAKE/packages/e/package.json"
echo '{"name":"@skeleton/tokens"}' > "$FAKE/packages/tokens/package.json"
echo '{"name":"@skeleton/theme"}' > "$FAKE/packages/theme/package.json"
plan_keep() { node "$HELPER" plan "$FAKE" 0 "$1" | sed -n 's/^keep //p' | tr '\n' ' ' | sed 's/ $//'; }
[ "$(plan_keep '')" = "a b c theme tokens" ] && pass "스타터가 쓰는 것 + 루트 도구(theme · tokens) + 그 닫힘(a → b → c)" || fail "plan 기본: [$(plan_keep '')]"
[ "$(plan_keep 'd')" = "a b c d theme tokens" ] && pass "--packages d 는 d 를 더하고 d 의 의존(c)은 이미 있다" || fail "plan d: [$(plan_keep 'd')]"
node "$HELPER" plan "$FAKE" 0 d | grep -q '^why d requested' && pass "고른 이유가 출력된다" || fail "고른 이유가 없다"
[ "$(node "$HELPER" plan "$FAKE" 0 '' | grep -c '^why c ')" = 1 ] && node "$HELPER" plan "$FAKE" 0 '' | grep -q '^why c needed by b' && pass "닫힘으로 따라온 것은 누가 불렀는지 출력된다" || fail "닫힘 이유가 없다"
[ "$(plan_keep 'e')" = "a b c e theme tokens" ] && pass "--packages e 도 닫힘 안에서 정렬되어 나온다" || fail "plan e: [$(plan_keep 'e')]"
expect_exit 3 "plan 은 없는 패키지를 목록과 함께 거절한다" node "$HELPER" plan "$FAKE" 0 zzz
echo "$LAST_OUTPUT" | grep -q 'valid packages: .*a' && pass "거절 메시지에 유효한 목록" || fail "거절 메시지: $LAST_OUTPUT"

echo "== 3. 기본값만"
MARKER="$TMP/marker"; touch "$MARKER"; sleep 1
A="$TMP/a"
expect_exit 0 "기본 조합을 찍는다" stamp "$A"
check "프로젝트 앱 apps/acme-app 만 남는다 (apps/starter · apps/workbench 없음)" bash -c "test -d '$A/apps/acme-app' && test ! -e '$A/apps/starter' && test ! -e '$A/apps/workbench'"
[ "$(json "$A/apps/acme-app/package.json" 'p.name')" = "acme-app" ] && pass "앱 package.json 이름" || fail "앱 package.json 이름"
check "index.html 제목" grep -q '<title>acme-app</title>' "$A/apps/acme-app/index.html"
check "헤더 브랜드 글자" grep -q '<strong>acme-app</strong>' "$A/apps/acme-app/src/layouts/RootLayout.tsx"
check ".env.example 첫 줄에 이름" bash -c "head -1 '$A/apps/acme-app/.env.example' | grep -q 'acme-app'"
want="api-client auth theme time tokens ui"
[ "$(listing "$A/packages")" = "$want" ] && pass "패키지는 스타터가 쓰는 것 + 도구만 남는다 ($want)" || fail "packages: [$(listing "$A/packages")] expected [$want]"
[ "$(json "$A/package.json" 'p.name')" = "acme-app-workspace" ] && pass "루트 이름은 <이름>-workspace (앱 이름과 겹치지 않는다)" || fail "루트 이름"
[ "$(json "$A/package.json" 'p.scripts.dev')" = "pnpm --filter acme-app dev" ] && pass "pnpm dev 가 새 앱을 가리킨다" || fail "dev 스크립트: $(json "$A/package.json" 'p.scripts.dev')"
[ "$(json "$A/package.json" 'p.scripts["dev:workbench"] === undefined')" = "true" ] && pass "워크벤치를 안 가져오면 dev:workbench 도 없다" || fail "dev:workbench 가 남았다"
check "pnpm test 가 new-project 테스트를 부르지 않는다 (새 프로젝트에는 도구가 없다)" bash -c "! grep -q 'new-project' '$A/package.json'"
check "new-project 도구 · 스켈레톤 전용 테스트 · 워크플로가 따라오지 않는다" bash -c "test ! -e '$A/scripts' -o -z \"\$(ls '$A/scripts' 2>/dev/null)\"; test ! -e '$A/tests/skeleton.repo.test.ts'; test ! -e '$A/.github/workflows/new-project.yml'"
check "CI 워크플로(ci.yml)는 남는다" test -f "$A/.github/workflows/ci.yml"
check "eslint 의 앱 이름 막기에 새 앱 이름이 더해진다" grep -q "'acme-app/\*\*'" "$A/eslint.config.js"
check "pnpm-workspace.yaml 은 apps/* · packages/* 글롭 그대로" bash -c "grep -q 'apps/\*' '$A/pnpm-workspace.yaml' && grep -q 'packages/\*' '$A/pnpm-workspace.yaml'"
[ -z "$(dangling_deps "$A" @skeleton)" ] && pass "선언된 @skeleton 의존이 모두 남아 있는 패키지를 가리킨다" || fail "끊어진 의존: $(dangling_deps "$A" @skeleton)"
check "지운 패키지(notifications · storage · payment · realtime · captcha-turnstile)를 가리키는 줄이 코드 · 설정에 없다" bash -c "
  ! grep -rIE '@skeleton/(notifications|storage|payment|realtime|captcha-turnstile)' '$A/apps' '$A/tests' '$A/eslint.config.js' '$A/package.json' '$A/tsconfig.json' '$A/tsconfig.base.json' '$A/.github' '$A/packages' --include='*.ts' --include='*.tsx' --include='*.json' --include='*.js' --include='*.yml' --exclude-dir=node_modules"
check "README · CLAUDE · CHANGELOG 는 새 프로젝트용으로 다시 쓰인다" bash -c "head -1 '$A/README.md' | grep -q '# acme-app' && head -1 '$A/CLAUDE.md' | grep -q 'acme-app' && grep -q 'Unreleased' '$A/CHANGELOG.md' && ! grep -q 'Migration —' '$A/CHANGELOG.md'"
check "README 에 남은 패키지 표와 다음 단계 명령이 있다" bash -c "grep -q '@skeleton/ui' '$A/README.md' && grep -q 'pnpm install' '$A/README.md'"
check "node_modules · dist · .git 은 복사되지 않는다" bash -c "! find '$A' -name node_modules -o -name dist -o -name .git | grep -q ."
check "소스 레포는 건드리지 않는다" bash -c "[ -z \"\$(find '$SRC' -newer '$MARKER' -type f -not -path '*/node_modules/*' -not -path '*/dist/*' -not -path '*/.git/*' 2>/dev/null | head -1)\" ]"
D="$TMP/a2"
stamp "$D" >/dev/null
check "같은 인자로 두 번 찍으면 결과가 같다" diff -r "$A" "$D"

echo "== 4. --packages realtime,notifications,storage"
B="$TMP/b"
expect_exit 0 "조합 2 를 찍는다" stamp "$B" --packages realtime,notifications,storage
want="api-client auth notifications realtime storage theme time tokens ui"
[ "$(listing "$B/packages")" = "$want" ] && pass "고른 패키지가 더해진다 ($want)" || fail "packages: [$(listing "$B/packages")]"
[ "$(json "$B/apps/acme-app/package.json" 'Object.keys(p.dependencies).filter(d => d.startsWith("@skeleton/")).join(" ")')" = "$(json "$A/apps/acme-app/package.json" 'Object.keys(p.dependencies).filter(d => d.startsWith("@skeleton/")).join(" ")')" ] && pass "앱의 의존 줄은 늘지 않는다 (쓰기 시작할 때 한 줄을 더한다 — 안 쓰는 의존을 선언하면 루트 테스트가 막는다)" || fail "앱 의존이 바뀌었다"
[ -z "$(dangling_deps "$B" @skeleton)" ] && pass "끊어진 의존 없음" || fail "끊어진 의존: $(dangling_deps "$B" @skeleton)"
echo "$LAST_OUTPUT" | grep -q 'notifications' && pass "출력에 고른 패키지가 나온다" || fail "출력에 notifications 가 없다"

echo "== 5. --scope @acme --packages payment"
C="$TMP/c"
expect_exit 0 "조합 3 을 찍는다" stamp "$C" --scope @acme --packages payment
want="api-client auth payment theme time tokens ui"
[ "$(listing "$C/packages")" = "$want" ] && pass "패키지 ($want)" || fail "packages: [$(listing "$C/packages")]"
[ "$(json "$C/packages/payment/package.json" 'p.name')" = "@acme/payment" ] && pass "패키지 이름이 @acme/payment" || fail "패키지 이름"
[ "$(json "$C/apps/acme-app/package.json" 'p.dependencies["@acme/ui"]')" = "workspace:*" ] && pass "앱의 의존이 @acme/* 로 바뀐다" || fail "앱 의존 스코프"
if grep -rIl -e '@skeleton' "$C" --exclude-dir=node_modules --exclude=pnpm-lock.yaml 2>/dev/null | grep -q .; then
  fail "@skeleton 이 남았다 (pnpm-lock.yaml 제외): $(grep -rIl -e '@skeleton' "$C" --exclude-dir=node_modules --exclude=pnpm-lock.yaml | head -5 | tr '\n' ' ')"
else pass "@skeleton 이 (잠금 파일 말고는) 어디에도 남지 않는다"; fi
check "정규식 안의 이스케이프된 @skeleton\\/ 도 바뀐다 (tests/support/workspaceRules.ts)" bash -c "grep -q '@acme' '$C/tests/support/workspaceRules.ts' && ! grep -qF '@skeleton' '$C/tests/support/workspaceRules.ts'"
check "토큰 확장 키 \$extensions.skeleton 은 스코프가 아니라서 그대로다" grep -q '"skeleton"' "$C/packages/tokens/tokens.json"
[ -z "$(dangling_deps "$C" @acme)" ] && pass "끊어진 의존 없음" || fail "끊어진 의존: $(dangling_deps "$C" @acme)"

echo "== 6. --with-workbench"
W="$TMP/w"
expect_exit 0 "워크벤치를 함께 찍는다" stamp "$W" --with-workbench
check "apps/workbench 가 남고 dev:workbench 스크립트가 있다" bash -c "test -d '$W/apps/workbench' && node -e \"process.exit(JSON.parse(require('fs').readFileSync('$W/package.json','utf8')).scripts['dev:workbench'] ? 0 : 1)\""
want="api-client auth captcha-turnstile notifications payment realtime storage theme time tokens ui"
[ "$(listing "$W/packages")" = "$want" ] && pass "워크벤치가 쓰는 패키지 전부가 따라온다" || fail "packages: [$(listing "$W/packages")]"
[ -z "$(dangling_deps "$W" @skeleton)" ] && pass "끊어진 의존 없음" || fail "끊어진 의존: $(dangling_deps "$W" @skeleton)"

if [ "$MODE" = "--full" ]; then
  echo "== 7. 조합마다 pnpm install · format · lint · typecheck · test · build (순차)"
  verify_composition() { # verify_composition <dir> <이름>
    local dir="$1" name="$2" started ended step
    started="$(date +%s)"
    for step in "install --no-frozen-lockfile --prefer-offline" "format" "tokens:check" "lint" "typecheck" "test" "format:check" "build"; do
      if ! (cd "$dir" && pnpm $step > "$TMP/$name-${step%% *}.log" 2>&1); then
        ended="$(date +%s)"
        fail "$name: pnpm ${step%% *} 실패 ($((ended - started))초) — 로그 마지막 줄:"
        tail -25 "$TMP/$name-${step%% *}.log" | sed 's/^/      /'
        return
      fi
    done
    ended="$(date +%s)"
    pass "$name: install · format · tokens:check · lint · typecheck · test · format:check · build 통과 ($((ended - started))초)"
  }
  verify_composition "$A" "1-defaults"
  verify_composition "$B" "2-packages"
  verify_composition "$C" "3-scope-payment"
fi

echo
if [ "$FAILURES" -gt 0 ]; then
  echo "FAIL: $FAILURES 개 실패 ($MODE)"
  exit 1
fi
echo "all passed ($MODE)"
