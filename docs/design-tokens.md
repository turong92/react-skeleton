# 디자인 토큰

색 · 그림자 · 서체 · 간격 · 모서리 · 글자 크기는 **`packages/tokens/tokens.json` 한 곳**에서 정하고, 생성기가 `packages/tokens/tokens.css` 를 만든다(패키지 `@skeleton/tokens`). 스켈레톤은 **메커니즘**(토큰 정본 + 생성기 + 라이트/다크 + 테스트)만 주고, 취향(색 값)은 이 스켈레톤에서 시작한 프로젝트가 `tokens.json` 값을 바꿔 정한다. 앱은 `import '@skeleton/tokens/tokens.css'` 로 불러온다.

```bash
pnpm tokens         # tokens.json → packages/tokens/tokens.css + 이 문서의 표 구역을 다시 쓴다
pnpm tokens:check   # 쓰지 않고 비교 — 생성물이 어긋났으면 종료 코드 1 (CI 가 돌린다)
```

## 층 — 둘만 둔다

| 층 | CSS 이름 | 정본 위치 | 규칙 |
|---|---|---|---|
| 원시(primitive) | `--p-*` (`color.neutral.50` → `--p-neutral-50`, `space.3` → `--p-space-3`, `shadow.raised-dark` → `--p-shadow-raised-dark`) | `color` · `shadow` · `font-family` · `space` · `radius` · `font-size` · `line-height` 묶음 | 값만 가진다. 다른 토큰을 참조하지 않는다. **화면 CSS · 컴포넌트가 직접 쓰지 않는다** |
| 의미(semantic) | `--<이름>` (`semantic.surface.bg` → `--bg`) | `semantic.<절>.<이름>` | 원시(또는 다른 의미 토큰)를 `{경로}` 로 **참조만** 한다. 색 날값 금지. 화면이 쓰는 이름은 이쪽이다 |

- 참조는 CSS 에서 `var(--…)` 로 남는다. 그래서 다크 블록이 `--bg` 만 덮어도 `--bg` 를 참조하는 다른 의미 토큰이 같이 따라간다.
- 의미 토큰의 **절**(`surface` · `text` · …)은 이 문서 표의 한 칸 묶음이다. 절의 `$extensions.skeleton.title` 이 표 제목, `$description` 이 표 아래 메모.
- CSS 이름은 절을 빼고 **마지막 이름만** 쓴다. 그래서 절이 달라도 이름이 겹치면 생성기가 던진다.
- 값에 문자열이 섞여도 된다(그림자 · 서체 묶음). W3C 객체 꼴 대신 CSS 글자 그대로 둔다.

### 부품(component) 층이 필요해지면

스켈레톤에는 없다. 프로젝트가 버튼 · 카드 같은 부품을 여러 화면에서 같은 모양으로 그리게 되면:

1. `tokens.json` 에 `component.<부품>.<이름>` 묶음을 더한다(예: `component.button.primary-bg` → `{semantic.surface.inverse}`). 값은 **의미 토큰만** 참조한다.
2. `packages/tokens/build.mjs` 의 `layerOf` · `cssNameOf` 에 `component` 를 더한다(`--<부품>-<이름>`), `renderCss` 에 의미 블록 뒤 부품 블록을 낸다. 다크는 의미 토큰을 따라가므로 부품에는 테마 값을 두지 않는다.
3. 테스트(`packages/tokens/src/tokens.test.ts`)의 「층은 둘」 검사를 셋으로 고친다.

## 간격 · 모서리 · 글자 크기

색과 같은 두 층이다 — 원시 단계(`space.1…8` = 4 · 8 · 12 · 16 · 20 · 24 · 32px 의 **4px 격자**, `radius.1…3` · `full`, `font-size.1…6`, `line-height.tight|snug|normal`)를 의미 이름이 참조한다. 의미 토큰은 **테마와 무관**하다(라이트/다크 값이 같다).

| 의미 토큰 | 쓰임 |
|---|---|
| `--space-xs` … `--space-3xl` | `padding` · `margin` · `gap` (4 · 8 · 12 · 16 · 20 · 24 · 32px) |
| `--radius-sm` · `-md` · `-lg` · `-full` | `border-radius` (4 · 6 · 8px · 알약/원) |
| `--font-size-caption` · `-small` · `-body` · `-subheading` · `-heading` · `-title` | `font-size` (12 · 13 · 15 · 16 · 20 · 28px — `h3` · `h2` · `h1` 이 subheading · heading · title) |
| `--line-height-tight` · `-snug` · `-normal` | `line-height` (1.2 · 1.35 · 1.5) |

- 화면 CSS · 인라인 style 에서 `padding` · `margin` · `gap` · `border-radius` · `font-size` 에 px/rem/em 날값을 쓰지 않는다(0 · `auto` · `%` · `var()` 는 된다). 두 앱과 모든 패키지를 루트 `tests/usage.test.ts` 가 `findRawLayout`(`@skeleton/tokens`)으로 막는다. **예외: `apps/workbench` CSS**(토큰 이전부터 쌓인 540줄 — 옮기면 `tests/support/layoutExempt.ts` 를 비운다).
- 4px 격자에 없던 옛 값(6 · 10 · 14px)은 가까운 단계로 맞췄다(컴포넌트 안쪽 여백이 최대 2px 달라졌다). 서체 **두께**는 토큰이 아니다(컴포넌트 CSS 에 있다). `width` · `height` · `border` 굵기 · `outline` 은 검사 대상이 아니다.
- 단계를 더하려면 `tokens.json` 에 원시 값과 `semantic.spacing|radius|type` 항목을 더하고 `pnpm tokens`.

## 테마

- `<html data-theme="light|dark">` 로 고른다. `data-theme` 가 없거나 `system` 이면 OS 설정(`prefers-color-scheme`)을 **CSS 만으로** 따라간다(새로 고침 불필요).
- 생성 CSS 의 블록: 기본 테마 `:root` · 다른 테마 `html[data-theme='<이름>']` · 시스템 `@media (prefers-color-scheme: dark) { :root:not([data-theme='light']) }`. 시스템 블록은 다크 블록과 같은 선언이다(테스트가 대조).
- 테마마다 `color-scheme` 이 걸려 폼 컨트롤 · 스크롤 막대도 따라간다.
- 고른 값은 `packages/theme/src/theme.ts`(`@skeleton/theme`)가 `localStorage` 에 저장하고 `<html data-theme>` 에 단다(레이아웃의 토글 버튼이 `setTheme` 을 부른다). 첫 칠 전에는 `PRE_PAINT_SCRIPT` 가 같은 키 상수로 먼저 단다 — 각 앱의 `vite.config.ts` 가 `themePrePaint()` 플러그인으로 `<head>` 에 인라인한다(깜빡임 방지).
- 대비: 루트 `tests/contrast.test.ts` 가 두 앱과 패키지가 실제로 쓰는 글자/바탕 짝을 **모든 테마**에서 WCAG AA(본문 4.5:1 · 큰 글자 / UI 경계 3:1)로 잰다. 화면에 새 짝이 생기면 거기에 한 줄 더한다.

## 확장 키

정본의 확장은 `$extensions.skeleton` 이다(생성기 `packages/tokens/build.mjs` 맨 위 `EXT`). 프로젝트가 이름을 바꾸려면 `build.mjs` 의 `EXT` 와 `tokens.json` 의 키를 함께 바꾼다(테스트는 키 이름에 기대지 않는다).

| 위치 | 키 | 뜻 |
|---|---|---|
| 정본 맨 위 | `$extensions.skeleton.themes` | 테마 목록 `[{ name, title, colorScheme, system }]`. 없으면 light · dark. 첫 테마가 기본(`$value`), `system: true` 인 테마(하나까지)가 OS 설정을 따른다 |
| 의미 토큰 | `$extensions.skeleton.<테마 이름>` | 그 테마의 값(참조만). 없으면 기본 값의 참조가 그 테마에서 다시 풀린다 |
| 의미 절 | `$extensions.skeleton.title` | 문서 표 제목 |

## 토큰 하나 더하기

1. 필요하면 원시 값을 `color` · `shadow` 같은 묶음에 더한다(`$value` 와 `$description`).
2. `semantic.<절>.<이름>` 을 더한다: `$value` 는 라이트 참조, 다크 값은 `$extensions.skeleton.dark`. 색 의미 토큰은 다크 값이 없으면 테스트가 막는다(원시를 직접 가리키는 경우).
3. `pnpm tokens` → 화면 CSS 에서 `var(--이름)` 으로 쓴다. 날 색 · `--p-*` 직접 사용 · 정의 없는 `var()` 는 루트 `tests/usage.test.ts` 가 막는다(두 앱 + 모든 패키지).
4. 글자색이면 `tests/contrast.test.ts` 에 어떤 바탕 위에 쓰는지 짝을 더한다.

## 테마 하나 더하기 (예: sepia)

1. `tokens.json` 맨 위 `themes` 에 한 줄 더한다: `{ "name": "sepia", "title": "sepia", "colorScheme": "light" }`.
2. 의미 토큰마다 `$extensions.skeleton.sepia` 값을 단다(바꿀 것만 — 없으면 기본 값이 쓰인다). 필요한 원시 단계도 더한다.
3. `pnpm tokens`. 생성 CSS 에 `html[data-theme='sepia']` 블록이 생기고 문서 표에 칸이 늘어난다.
4. `packages/theme/src/themeNames.ts` 의 `THEMES` 에 이름을 더한다(`tests/theme.names.test.ts` 가 정본 목록과 어긋나면 막는다), 대비 테스트의 테마 목록에 sepia 를 더한다.

## 프로젝트가 색을 바꾸려면

`tokens.json` 의 **원시 값**(`color.*`)을 바꾸고 `pnpm tokens` 를 돌린다. 이름을 그대로 두면 화면 CSS 는 건드릴 필요가 없다. 바꾼 뒤 `pnpm test` 의 대비 검사가 AA 미달을 알려 준다. 의미 토큰이 가리키는 원시를 바꾸고 싶으면 `semantic.*` 의 참조(와 `dark`)를 고친다.

## 생성된 표

아래는 생성 구역이다 — 손으로 고치지 않는다(`pnpm tokens`).

<!-- tokens:start -->
<!-- generated region — do not edit by hand. source tokens.json, run `pnpm tokens` -->

### Surface

| token | light | dark | reference | purpose |
|---|---|---|---|---|
| `--bg` | `#f5f7f6` | `#0f1412` | `--p-neutral-100` · dark `--p-night-900` | 화면 바탕 |
| `--surface` | `#ffffff` | `#161d1a` | `--p-neutral-0` · dark `--p-night-800` | 카드 · 입력칸 바탕 |
| `--surface-alt` | `#fbfcfb` | `#131a17` | `--p-neutral-50` · dark `--p-night-850` | 카드 안 옅은 바탕(스트림 · 모듈 · 교환 항목) |
| `--surface-muted` | `#eef2f0` | `#1d2622` | `--p-neutral-200` · dark `--p-night-700` | 옅은 면 |
| `--surface-sunken` | `#eff4f1` | `#0b100e` | `--p-neutral-150` · dark `--p-night-950` | 움푹한 블록 바탕(JSON · 로그) |
| `--code-bg` | `#e7ece9` | `#212b27` | `--p-neutral-250` · dark `--p-night-600` | code · 알약 바탕 |
| `--header-bg` | `rgba(255, 255, 255, 0.92)` | `rgba(15, 20, 18, 0.88)` | `--p-alpha-white-92` · dark `--p-alpha-night-88` | 고정 헤더 바탕(반투명) |
| `--inverse` | `#17201c` | `#e7ece9` | `--p-neutral-850` · dark `--p-neutral-250` | 반전 면 — 눌리는 검정 버튼 · 브랜드 마크 |

### Text

| token | light | dark | reference | purpose |
|---|---|---|---|---|
| `--text` | `#2a2d2b` | `#d8dfda` | `--p-neutral-800` · dark `--p-neutral-300` | 본문 글자 |
| `--text-muted` | `#69706c` | `#9aa6a0` | `--p-neutral-600` · dark `--p-neutral-500` | 보조 글자 |
| `--text-strong` | `#111413` | `#f5f7f6` | `--p-neutral-900` · dark `--p-neutral-100` | 제목 · 강조 글자 |
| `--on-inverse` | `#ffffff` | `#111413` | `--p-neutral-0` · dark `--p-neutral-900` | 반전 면(--inverse)과 강조색(--teal) 바탕 위 글자 |

### Border

| token | light | dark | reference | purpose |
|---|---|---|---|---|
| `--border` | `#d8dfda` | `#2b3631` | `--p-neutral-300` · dark `--p-night-500` | 옅은 선 |
| `--border-strong` | `#b9c4bd` | `#3d4a44` | `--p-neutral-400` · dark `--p-night-400` | 진한 선 · 입력 · 빈 칸 점선 |

선은 장식이라 대비 검사 대상이 아니다. 입력칸 경계처럼 반드시 보여야 하는 곳이 생기면 tests/contrast.test.ts 에 짝을 더한다.

### Accent and status

| token | light | dark | reference | purpose |
|---|---|---|---|---|
| `--teal` | `#0f766e` | `#5cd6c6` | `--p-teal-700` · dark `--p-teal-300` | 강조 · 성공 · 포커스 |
| `--teal-soft` | `#dff5f0` | `#12332f` | `--p-teal-100` · dark `--p-teal-900` | 강조 알약 바탕 · 포커스 윤곽 |
| `--teal-wash` | `rgba(15, 118, 110, 0.08)` | `rgba(92, 214, 198, 0.1)` | `--p-alpha-teal-8` · dark `--p-alpha-teal-10` | 강조 번짐(그라디언트 시작) |
| `--amber` | `#975c0f` | `#e0a24a` | `--p-amber-700` · dark `--p-amber-300` | 경고 · 연결 중 |
| `--amber-soft` | `#fff0d5` | `#3a2b12` | `--p-amber-100` · dark `--p-amber-900` | 경고 알약 바탕 |
| `--red` | `#b33b2e` | `#f08a7e` | `--p-red-700` · dark `--p-red-300` | 오류 |
| `--red-soft` | `#ffe2de` | `#3d1f1b` | `--p-red-100` · dark `--p-red-900` | 오류 알약 · 상자 바탕 |
| `--red-border` | `#f5b5ad` | `#7a3a33` | `--p-red-200` · dark `--p-red-800` | 오류 상자 테두리 |

### Effect

| token | light | dark | reference | purpose |
|---|---|---|---|---|
| `--shadow` | `0 18px 45px rgba(36, 47, 43, 0.08)` | `0 18px 45px rgba(0, 0, 0, 0.45)` | `--p-shadow-raised-light` · dark `--p-shadow-raised-dark` | 떠 있는 면 그림자 |

### Font

| token | light | dark | reference | purpose |
|---|---|---|---|---|
| `--sans` | `'Avenir Next', 'IBM Plex Sans KR', 'Noto Sans KR', ui-sans-serif, system-ui, sans-serif` | = | `--p-font-family-sans` | 본문 서체 |
| `--mono` | `'JetBrains Mono', 'SFMono-Regular', Consolas, ui-monospace, monospace` | = | `--p-font-family-mono` | 고정폭 서체 |

### Spacing

| token | light | dark | reference | purpose |
|---|---|---|---|---|
| `--space-xs` | `4px` | = | `--p-space-1` | 아이콘 옆 · 촘촘한 줄 간격 |
| `--space-sm` | `8px` | = | `--p-space-2` | 입력 · 버튼 안 간격, 작은 gap |
| `--space-md` | `12px` | = | `--p-space-3` | 기본 gap · 헤더 안 간격 |
| `--space-lg` | `16px` | = | `--p-space-4` | 묶음 사이 · 푸터 여백 |
| `--space-xl` | `20px` | = | `--p-space-5` | 카드 · 대화상자 안쪽 여백 |
| `--space-2xl` | `24px` | = | `--p-space-6` | 화면 가장자리 여백 |
| `--space-3xl` | `32px` | = | `--p-space-8` | 큰 구획 사이 |

4px 격자. 컴포넌트의 padding · margin · gap 은 이 이름만 쓴다(날 px 는 루트 tests/usage.test.ts 가 막는다).

### Radius

| token | light | dark | reference | purpose |
|---|---|---|---|---|
| `--radius-sm` | `4px` | = | `--p-radius-1` | code · 오류 상자 |
| `--radius-md` | `6px` | = | `--p-radius-2` | 입력 · 버튼 · 카드 · 대화상자 |
| `--radius-lg` | `8px` | = | `--p-radius-3` | 큰 면 · 팝오버 |
| `--radius-full` | `9999px` | = | `--p-radius-full` | 알약 · 스피너 · 스위치 |

모서리 둥글기.

### Type scale

| token | light | dark | reference | purpose |
|---|---|---|---|---|
| `--font-size-caption` | `12px` | = | `--p-font-size-1` | 캡션 · 도움말 · 라벨 |
| `--font-size-small` | `13px` | = | `--p-font-size-2` | 작은 버튼 · 보조 글 |
| `--font-size-body` | `15px` | = | `--p-font-size-3` | 본문(기본) |
| `--font-size-subheading` | `16px` | = | `--p-font-size-4` | h3 |
| `--font-size-heading` | `20px` | = | `--p-font-size-5` | h2 |
| `--font-size-title` | `28px` | = | `--p-font-size-6` | h1 |
| `--line-height-tight` | `1.2` | = | `--p-line-height-tight` | 제목 |
| `--line-height-snug` | `1.35` | = | `--p-line-height-snug` | code · pre |
| `--line-height-normal` | `1.5` | = | `--p-line-height-normal` | 본문 |

역할 이름 — 글자 크기와 줄 높이. 서체 두께는 이 스켈레톤이 토큰으로 정하지 않는다(컴포넌트 CSS 에 있다).

### Primitive palette (`--p-*`)

Values the semantic tokens reference. Never use these directly in screen CSS or components.

| token | value | description |
|---|---|---|
| `--p-neutral-0` | `#ffffff` | 순백 — 카드 · 입력칸 바탕, 반전 글자 |
| `--p-neutral-50` | `#fbfcfb` | 카드 안 옅은 바탕 |
| `--p-neutral-100` | `#f5f7f6` | 화면 바탕 / 다크의 강한 글자 |
| `--p-neutral-150` | `#eff4f1` | JSON · 로그 블록 바탕 |
| `--p-neutral-200` | `#eef2f0` | 옅은 면 |
| `--p-neutral-250` | `#e7ece9` | code · 알약 바탕 / 다크의 반전 바탕 |
| `--p-neutral-300` | `#d8dfda` | 옅은 선 / 다크의 본문 글자 |
| `--p-neutral-400` | `#b9c4bd` | 진한 선 |
| `--p-neutral-500` | `#9aa6a0` | 다크의 보조 글자 |
| `--p-neutral-600` | `#69706c` | 보조 글자 |
| `--p-neutral-800` | `#2a2d2b` | 본문 글자 |
| `--p-neutral-850` | `#17201c` | 반전 바탕(검정 버튼 · 브랜드 마크) |
| `--p-neutral-900` | `#111413` | 강한 글자 / 다크의 반전 글자 |
| `--p-night-400` | `#3d4a44` | 진한 선 |
| `--p-night-500` | `#2b3631` | 옅은 선 |
| `--p-night-600` | `#212b27` | code 바탕 |
| `--p-night-700` | `#1d2622` | 옅은 면 |
| `--p-night-800` | `#161d1a` | 다크 카드 · 입력칸 바탕 |
| `--p-night-850` | `#131a17` | 카드 안 바탕 |
| `--p-night-900` | `#0f1412` | 다크 화면 바탕 |
| `--p-night-950` | `#0b100e` | 가장 어두운 면 |
| `--p-teal-100` | `#dff5f0` | 옅은 강조 바탕 |
| `--p-teal-300` | `#5cd6c6` | 다크 강조 |
| `--p-teal-700` | `#0f766e` | 강조 |
| `--p-teal-900` | `#12332f` | 다크 옅은 강조 바탕 |
| `--p-amber-100` | `#fff0d5` | 옅은 경고 바탕 |
| `--p-amber-300` | `#e0a24a` | 다크 경고 |
| `--p-amber-700` | `#975c0f` | 경고 — 옛 #a86612 는 amber-soft · code 위 AA 미달이라 한 단계 어둡게 |
| `--p-amber-900` | `#3a2b12` | 다크 옅은 경고 바탕 |
| `--p-red-100` | `#ffe2de` | 옅은 오류 바탕 |
| `--p-red-200` | `#f5b5ad` | 오류 상자 테두리 |
| `--p-red-300` | `#f08a7e` | 다크 오류 |
| `--p-red-700` | `#b33b2e` | 오류 |
| `--p-red-800` | `#7a3a33` | 다크 오류 상자 테두리 |
| `--p-red-900` | `#3d1f1b` | 다크 옅은 오류 바탕 |
| `--p-alpha-white-92` | `rgba(255, 255, 255, 0.92)` | 라이트 헤더 바탕 |
| `--p-alpha-night-88` | `rgba(15, 20, 18, 0.88)` | 다크 헤더 바탕 |
| `--p-alpha-teal-8` | `rgba(15, 118, 110, 0.08)` | 라이트 강조 번짐 |
| `--p-alpha-teal-10` | `rgba(92, 214, 198, 0.1)` | 다크 강조 번짐 |
| `--p-shadow-raised-light` | `0 18px 45px rgba(36, 47, 43, 0.08)` | 라이트 떠 있는 면 |
| `--p-shadow-raised-dark` | `0 18px 45px rgba(0, 0, 0, 0.45)` | 다크 떠 있는 면 |
| `--p-font-family-sans` | `'Avenir Next', 'IBM Plex Sans KR', 'Noto Sans KR', ui-sans-serif, system-ui, sans-serif` | 본문 서체 |
| `--p-font-family-mono` | `'JetBrains Mono', 'SFMono-Regular', Consolas, ui-monospace, monospace` | 고정폭 서체 |
| `--p-space-1` | `4px` | 촘촘한 간격 |
| `--p-space-2` | `8px` | 기본 작은 간격 |
| `--p-space-3` | `12px` | 기본 간격 |
| `--p-space-4` | `16px` | 넉넉한 간격 |
| `--p-space-5` | `20px` | 카드 안쪽 여백 |
| `--p-space-6` | `24px` | 화면 여백 |
| `--p-space-8` | `32px` | 큰 구획 |
| `--p-radius-1` | `4px` | 작은 조각(code · 오류 상자) |
| `--p-radius-2` | `6px` | 입력 · 버튼 · 카드 |
| `--p-radius-3` | `8px` | 큰 면 · 팝오버 |
| `--p-radius-full` | `9999px` | 알약 · 원 — 어떤 크기에서도 끝이 둥글다 |
| `--p-font-size-1` | `12px` | 캡션 · 도움말 |
| `--p-font-size-2` | `13px` | 작은 글자 |
| `--p-font-size-3` | `15px` | 본문 |
| `--p-font-size-4` | `16px` | 소제목 |
| `--p-font-size-5` | `20px` | 제목 |
| `--p-font-size-6` | `28px` | 큰 제목 |
| `--p-line-height-tight` | `1.2` | 제목 |
| `--p-line-height-snug` | `1.35` | 코드 · 촘촘한 글 |
| `--p-line-height-normal` | `1.5` | 본문 |
<!-- tokens:end -->
