#!/usr/bin/env bash
# 새 프로젝트 한 줄 찍어내기: 복사 → 필요한 패키지만 남기기 → 앱 이름 바꾸기 → (선택) 스코프 바꾸기 → 문서 다시 쓰기.
#
#   scripts/new-project.sh <target-dir> <name> [--packages a,b,c] [--ssr] [--without-storybook] [--with-workbench] [--with-sample] [--scope @acme]
#
#   예) scripts/new-project.sh ~/work/ovation ovation
#       scripts/new-project.sh ~/work/ovation ovation --packages realtime,notifications,storage
#       scripts/new-project.sh ~/work/ovation ovation --scope @ovation --packages payment
#       scripts/new-project.sh ~/work/ovation ovation --packages seo,marketing  # 공개 페이지(랜딩 · 요금제 · 약관 · 동의 배너 · 404)와 검색용 머리 · 사이트맵
#       scripts/new-project.sh ~/work/ovation ovation --ssr                    # 서버 렌더 스타터(스토리집은 기본으로 따라온다 · 머리는 @skeleton/seo 가 따라온다)
#       scripts/new-project.sh ~/work/ovation ovation --without-storybook      # 스토리집 · 스토리 · 에이전트 안내 없이
#
# 하는 일
#   1. 이 레포를 <target-dir> 로 복사한다 (node_modules · dist · .git · .claude · .superpowers · .env · *.local 제외).
#   2. apps/starter 를 apps/<name> 으로 바꾼다 (package.json 이름 · index.html 제목 · 헤더 브랜드 · .env.example 첫 줄).
#      --ssr 이면 apps/starter-ssr(서버가 첫 응답을 그리는 스타터)가 대신 apps/<name> 이 되고 apps/starter 는 지운다
#      (이름은 src/appName.ts 한 줄 · Dockerfile 의 ARG APP).
#      apps/workbench 는 --with-workbench 일 때만 남긴다(그러면 그 앱이 쓰는 패키지가 전부 따라온다).
#      apps/sample(참조 앱 Notes: 로그인 · 대시보드 · 목록 · 상세 · 폼 · 첨부 · 알림 · 설정)은 기본으로 떼고 --with-sample 일 때만 남긴다
#      (그 앱이 쓰는 패키지가 따라오고, 샘플 전용 루트 스크립트 dev:sample · e2e:sample · CI 의 e2e 잡도 함께 남는다).
#      apps/storybook(스토리집: 설정 · Patterns · 토큰 문서)은 기본으로 남는다 — 남는 패키지의 스토리(*.stories.tsx · 가짜) · docs/ui-catalog.md ·
#      CLAUDE.md 의 에이전트 안내 · 스토리 테스트(tests/stories.test.ts) · 스토리집 도구 · CI 의 stories 잡이 함께 간다(참조가 프로젝트와 함께 간다).
#      --without-storybook 이면 이 전부를 뗀다(날 요소를 막는 ESLint 규칙은 부품이 남아 있으니 그대로).
#   3. 패키지 = 스타터가 쓰는 것 + 루트 도구(theme · tokens) + --packages, 패키지끼리의 @skeleton/* 의존으로 닫는다.
#      나머지 packages/<p> 는 지운다. 이 목록을 보고 있던 루트 테스트(tests/skeleton.repo.test.ts)도 지운다.
#      고른 패키지는 폴더만 복사된다 — 앱 package.json 에 `"@skeleton/<p>": "workspace:*"` 한 줄은 쓰기 시작할 때 더한다
#      (안 쓰는 의존을 선언하면 루트 테스트 「선언한 의존 = 실제 import」가 막는다).
#   4. 루트 package.json(이름 · dev 스크립트 · test 에서 이 도구 빼기) · eslint 앱 이름 막기 · 문서(README · CLAUDE · CHANGELOG)를 새 프로젝트용으로 바꾼다.
#   5. --scope 가 있으면 모든 텍스트 파일의 @skeleton/ 을 <scope>/ 로 바꾼다.
#   6. new-project 도구(이 스크립트 · 테스트 · 워크플로)는 따라오지 않는다. pnpm-lock.yaml 은 복사본 그대로다 — `pnpm install --no-frozen-lockfile` 이 맞춘다.
#
# 종료 코드: 0 성공 / 1 도중 실패(대상이 남는다) / 2 인자 오류(아무것도 만들지 않는다).
# 소스 레포와 <target-dir> 밖에는 아무것도 쓰지 않는다. macOS bash 3.2 와 GNU 에서 돈다 (연관 배열 · mapfile 을 쓰지 않는다). node 가 필요하다.
set -euo pipefail

SRC="$(cd "$(dirname "$0")/.." && pwd -P)"
HELPER="$SRC/scripts/new-project.d/stamp.mjs"

usage() {
  cat <<'EOF2'
usage: scripts/new-project.sh <target-dir> <name> [--packages a,b,c] [--ssr] [--without-storybook] [--with-workbench] [--with-sample] [--scope @acme]

  <target-dir>      새로 만들 디렉토리 (이미 있으면 거부, 소스 레포 안이면 거부)
  <name>            앱 이름 = apps/<name> (소문자 · 숫자 · 하이픈, `workbench` · `storybook` · `sample` 은 예약)
  --packages        스타터에 더할 패키지, 쉼표로 구분 (예: realtime,notifications,storage)
  --ssr             앱을 서버 렌더 스타터(apps/starter-ssr: Node 서버 + 하이드레이션)로 — 기본은 SPA 스타터(apps/starter)
  --without-storybook  스토리집(apps/storybook) · 스토리 · 에이전트 안내 · 카탈로그를 떼고 찍는다 — 기본은 모두 따라온다
  --with-workbench  apps/workbench(백엔드 확인용 시각적 테스트 벤치)도 남긴다 — 모든 패키지가 남는다
  --with-sample     참조 앱 apps/sample(Notes)도 남긴다 — 백엔드 kotlin-skeleton 의 apps/sample 과 짝. 기본은 떼고 찍는다
  --scope           패키지 스코프를 바꾼다 (예: @acme → @acme/ui). 기본 @skeleton
EOF2
}

die_usage() { echo "x $*" >&2; echo >&2; usage >&2; exit 2; }
valid_packages() { # 소스 레포의 패키지 이름들 (정렬)
  local d
  for d in "$SRC"/packages/*/; do
    [ -f "$d/package.json" ] && basename "$d"
  done | sort
}
die_listing() { echo "x $*" >&2; echo "valid packages: $(valid_packages | tr '\n' ' ')" >&2; exit 2; }

# ---------------------------------------------------------------------------------------------------- 인자
POSITIONAL=()
PACKAGES_ARG=""
SCOPE="@skeleton"
WITH_WORKBENCH=0
WITH_SAMPLE=0
WITH_STORYBOOK=1
SSR=0
while [ $# -gt 0 ]; do
  case "$1" in
    --packages) [ $# -ge 2 ] && [ "${2#--}" = "$2" ] || die_usage "--packages needs a value"; PACKAGES_ARG="$2"; shift 2 ;;
    --packages=*) PACKAGES_ARG="${1#--packages=}"; shift ;;
    --scope) [ $# -ge 2 ] && [ "${2#--}" = "$2" ] || die_usage "--scope needs a value"; SCOPE="$2"; shift 2 ;;
    --scope=*) SCOPE="${1#--scope=}"; shift ;;
    --with-workbench) WITH_WORKBENCH=1; shift ;;
    --with-sample) WITH_SAMPLE=1; shift ;;
    --without-storybook) WITH_STORYBOOK=0; shift ;;
    --with-showcase) die_usage "--with-showcase is gone: the showcase moved into Storybook (apps/storybook), which every project keeps by default — use --without-storybook to drop it" ;;
    --ssr) SSR=1; shift ;;
    -h|--help) usage; exit 0 ;;
    --*) die_usage "unknown option: $1" ;;
    *) POSITIONAL+=("$1"); shift ;;
  esac
done
[ "${#POSITIONAL[@]}" -eq 2 ] || die_usage "expected 2 arguments (<target-dir> <name>), got ${#POSITIONAL[@]}"
TARGET_ARG="${POSITIONAL[0]}"; NAME="${POSITIONAL[1]}"

echo "$NAME" | grep -Eq '^[a-z][a-z0-9-]*$' || die_usage "name must be lower-case letters, digits, hyphens: $NAME"
[ "$NAME" != workbench ] || die_usage "the name 'workbench' is reserved (apps/workbench)"
[ "$NAME" != sample ] || die_usage "the name 'sample' is reserved (apps/sample)"
[ "$NAME" != storybook ] || die_usage "the name 'storybook' is reserved (apps/storybook)"
[ "$NAME" != storybook-app ] || die_usage "the name 'storybook-app' is reserved (the package name of apps/storybook)"
echo "$SCOPE" | grep -Eq '^@[a-z][a-z0-9-]*$' || die_usage "scope must look like @acme: $SCOPE"

ALL_PACKAGES="$(valid_packages)"
REQUESTED=""   # 요청 순서 유지, 중복 제거
if [ -n "$PACKAGES_ARG" ]; then
  while IFS= read -r p; do
    p="$(echo "$p" | tr -d '[:space:]')"
    [ -n "$p" ] || continue
    # (파이프 대신 here-string — `grep -q` 가 일찍 끝나면 printf 가 SIGPIPE 를 받고 pipefail 이 가끔 거짓 실패를 낸다)
    grep -Fxq -- "$p" <<<"$ALL_PACKAGES" || die_listing "unknown package: $p"
    grep -Fxq -- "$p" <<<"$(printf '%s' "$REQUESTED" | tr ',' '\n')" || REQUESTED="${REQUESTED:+$REQUESTED,}$p"
  done <<EOF2
$(printf '%s' "$PACKAGES_ARG" | tr ',' '\n')
EOF2
fi

case "$TARGET_ARG" in /*) TARGET="$TARGET_ARG" ;; *) TARGET="$PWD/$TARGET_ARG" ;; esac
TARGET="${TARGET%/}"
# `../내-프로젝트` · 심볼릭 링크를 정리한다 — 안 하면 레포 안에서 부른 `../x` 가 "레포 안" 으로 오인된다 (아직 없는 끝 구간은 그대로 붙인다)
normalize_path() {
  local p="$1" d b
  d="$(dirname "$p")"; b="$(basename "$p")"
  if [ -d "$d" ]; then printf '%s/%s' "$(cd "$d" && pwd -P)" "$b"; else printf '%s/%s' "$(normalize_path "$d")" "$b"; fi
}
[ -z "$TARGET" ] || TARGET="$(normalize_path "$TARGET")"
[ -n "$TARGET" ] || die_usage "target must not be /"
[ ! -e "$TARGET" ] || die_usage "target already exists: $TARGET"
case "$TARGET/" in "$SRC"/*) die_usage "target must be outside the skeleton repo ($SRC): $TARGET" ;; esac
command -v node >/dev/null || { echo "x node is required" >&2; exit 1; }

# ---------------------------------------------------------------------------------------------------- 계획
PLAN="$(node "$HELPER" plan "$SRC" "$WITH_WORKBENCH" "$REQUESTED" "$SSR" "$WITH_SAMPLE")" || { echo "$PLAN" >&2; exit 2; }
KEEP="$(printf '%s\n' "$PLAN" | sed -n 's/^keep //p' | tr '\n' ',' | sed 's/,$//')"
echo "== plan"
printf '%s\n' "$PLAN" | sed -n 's/^why /   /p'
echo "   app: apps/$NAME (from apps/$([ "$SSR" = 1 ] && echo starter-ssr || echo starter))$([ "$WITH_WORKBENCH" = 1 ] && echo ' + apps/workbench')$([ "$WITH_SAMPLE" = 1 ] && echo ' + apps/sample (reference app)')$([ "$WITH_STORYBOOK" = 1 ] && echo ' + apps/storybook (stories, patterns, guide)')"

# ---------------------------------------------------------------------------------------------------- 복사 · 변환
echo "== copy → $TARGET"
node "$HELPER" copy "$SRC" "$TARGET"
echo "== transform"
node "$HELPER" apply "$TARGET" "$NAME" "$SCOPE" "$WITH_WORKBENCH" "$KEEP" "$SSR" "$WITH_STORYBOOK" "$WITH_SAMPLE"

# ---------------------------------------------------------------------------------------------------- 안내
cat <<EOF2

done: $TARGET
next steps:
  cd $TARGET
  pnpm install --no-frozen-lockfile   # pnpm-lock.yaml 은 스켈레톤의 것 — 이름 · 스코프에 맞춰 고쳐진다. 결과를 커밋한다
  pnpm format                         # 이름 · 스코프를 바꾸면 줄바꿈이 달라질 수 있다 (한 번만)
  pnpm dev                            # apps/$NAME  $([ "$SSR" = 1 ] && echo http://localhost:3000 || echo http://localhost:5173)
  pnpm lint && pnpm typecheck && pnpm test && pnpm build$([ "$WITH_STORYBOOK" = 1 ] && printf '\n  pnpm storybook                      # 스토리집 http://localhost:6006 — 처음 한 번: pnpm exec playwright install chromium (test:stories 용)')
백엔드(kotlin-skeleton 에서 찍은 것)는 나란히 둔다: <작업 폴더>/api · <작업 폴더>/web(= 여기). api 에서 scripts/dev.sh 가 DB · S3 · 백엔드와 이 프론트(pnpm dev)를 한 번에 띄운다.
  Vite(5173)가 /api/v1 을 localhost:8080 으로 넘긴다 — 다른 포트면 API_PROXY_TARGET=http://localhost:<port> pnpm dev
packages you keep but do not use yet: add one line to apps/$NAME/package.json when you start using it, e.g.
  "$SCOPE/<package>": "workspace:*"   # 그러면 pnpm install 을 다시. 안 쓰는 의존은 선언하지 않는다(루트 테스트가 막는다)
EOF2
