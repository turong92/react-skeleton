# 디자인 토큰

색 · 그림자 · 서체 · 간격 · 모서리 · 글자 크기는 **`packages/tokens/tokens.json` 한 곳**에서 정하고, 생성기가 `packages/tokens/tokens.css` 를 만든다(패키지 `@skeleton/tokens`). 스켈레톤은 **메커니즘**(토큰 정본 + 생성기 + 라이트/다크 + 테스트)만 주고, 취향(색 값)은 이 스켈레톤에서 시작한 프로젝트가 `tokens.json` 값을 바꿔 정한다. 앱은 `import '@skeleton/tokens/tokens.css'` 로 불러온다.

```bash
pnpm tokens         # tokens.json → packages/tokens/tokens.css + 이 문서의 표 구역을 다시 쓴다
pnpm tokens:check   # 쓰지 않고 비교 — 생성물이 어긋났으면 종료 코드 1 (CI 가 돌린다)
```

## 층 — 셋

| 층 | CSS 이름 | 정본 위치 | 규칙 |
|---|---|---|---|
| 원시(primitive) | `--p-*` (`color.neutral.50` → `--p-neutral-50`, `space.3` → `--p-space-3`, `shadow.raised-dark` → `--p-shadow-raised-dark`) | `color` · `shadow` · `font-family` · `space` · `radius` · `font-size` · `line-height` 묶음 | 값만 가진다. 다른 토큰을 참조하지 않는다. **화면 CSS · 컴포넌트가 직접 쓰지 않는다** |
| 의미(semantic) | `--<이름>` (`semantic.surface.bg` → `--bg`) | `semantic.<절>.<이름>` | 원시(또는 다른 의미 토큰)를 `{경로}` 로 **참조만** 한다. 색 날값 금지. 화면이 쓰는 이름은 이쪽이다 |
| 부품(component) | `--<부품>-<이름>` (`component.button.radius` → `--button-radius`) | `component.<부품>.<이름>` | `@skeleton/ui` 부품 CSS 가 쓰는 손잡이. `$type` 필수. 원시 토큰을 참조하지 않고 색 날값(`#…` · `rgb()` · 이름 색)을 쓰지 않는다. 색은 의미(또는 다른 부품) 토큰을 참조하거나 끄기 값 `none` · `transparent`, 색 아닌 값(모서리 · 흐림 · 그림자 모양)은 날값도 된다. 테마 값을 두지 않는다(다크는 참조한 의미 토큰을 따라간다) |

- 참조는 CSS 에서 `var(--…)` 로 남는다. 그래서 다크 블록이 `--bg` 만 덮어도 `--bg` 를 참조하는 다른 의미 토큰이 같이 따라간다.
- 의미 토큰의 **절**(`surface` · `text` · …)은 이 문서 표의 한 칸 묶음이다. 절의 `$extensions.skeleton.title` 이 표 제목, `$description` 이 표 아래 메모.
- CSS 이름은 절을 빼고 **마지막 이름만** 쓴다. 그래서 절이 달라도 이름이 겹치면 생성기가 던진다.
- 값에 문자열이 섞여도 된다(그림자 · 서체 묶음). W3C 객체 꼴 대신 CSS 글자 그대로 둔다.

### 부품(component) 층 — 부품 모양을 토큰으로 바꾼다

부품 모양을 바꾸고 싶으면 부품 CSS 를 고치지 않고 `component` 절의 값을 바꾼다. 기본값은 지금 쓰던 의미 토큰을 그대로 잇는 것이라, 값을 바꾸지 않으면 지금 모양 그대로다.

**계열 단위**로 묶는다 — 같은 역할의 부품은 한 묶음의 손잡이를 같이 쓴다.

| 묶음 | 쓰는 부품 | 손잡이 |
|---|---|---|
| `button` | Button · 버튼 모양 부품(CopyButton · Pagination · RowMenu 단추 · Dialog 닫기 · ErrorReference 복사 · SectionCard 접기) | 모서리 · 주 버튼 채움/글자/테두리/hover · 보조 바탕/테두리/hover 바탕/hover 테두리 · 작은 단추 hover 바탕 · Pagination 테두리 · 보조 바탕 흐림 |
| `field` | Input · Select · Textarea · CodeEntry | 모서리 · 바탕 · 테두리 · 포커스 테두리/링 · 비활성 바탕 |
| `card` | Card · SectionCard · Stat · Table 틀 | 모서리 · 바탕 · 테두리 · 그림자 · 흐림 |
| `overlay` | Dialog · Combobox 목록 · RowMenu 메뉴 | 모서리 · 바탕 · 테두리 · 그림자 · 흐림 · 항목 모서리 · Dialog 덮개 |
| `shell` | AppShell 머리줄 | 바탕 · 테두리 · 흐림 · 내비 · 포커스 링 모서리 · 현재 링크 바탕 |
| `progress` · `choice`(ChoiceGroup) · `switch`(Switch · SwitchRow) · `badge`(Badge · SectionIndex) · `alert`(Alert · FormProblems) · `tooltip` · `avatar` · `skeleton` | 괄호 안 | 아래 표 |

- **흐림(`*-backdrop`)** 은 `backdrop-filter` 값이다. 기본 `none`, 유리 면이면 `blur(16px) saturate(1.5)` 처럼 날값을 그대로 쓰고 바탕(`*-bg`)을 반투명 의미 토큰으로 바꾼다(반투명 색은 의미 토큰으로 먼저 더한다). `none` 이 아닌 흐림은 그 요소를 `position: fixed` 자손의 기준 상자로 만든다 — 카드 · 머리줄 안에 화면 고정 요소를 두는 앱은 주의한다(부품의 Dialog 는 최상위 층이라 영향이 없다).
- **채움(`progress-fill`)** 은 색 또는 그라디언트다 — `linear-gradient(90deg, {semantic.…}, {semantic.…})`. 정해진 진행에만 쓰이고, 그라디언트는 채운 폭 안에 그려진다(10% 면 그라디언트 전체가 10% 안에). 끝을 모르는 진행 · 브라우저 기본 막대는 색만 받는 `progress-indeterminate` · `progress-indeterminate-still`.
- **글자색 짝**: 바탕을 바꾸는 손잡이 위 글자는 `button-primary-fg` · `tooltip-fg` 로 함께 바꾼다. 부품 토큰 짝도 루트 `tests/contrast.test.ts` 가 AA 로 잰다.
- 부품 토큰은 `:root` 와 모든 `[data-theme]` 컨테이너에 다시 선언된다(사용자 지정 속성의 `var()` 는 선언한 곳에서 풀려 상속되므로, 테마를 단 컨테이너 안의 부품도 그 테마 값을 받게). 그래서:
  - **부품 토큰은 `tokens.json` 에서 바꾼다.** 화면 CSS 에서 `--card-bg` 를 덮으면 그 안의 `[data-theme]` 요소에서 기본값으로 되돌아간다.
  - 화면 CSS 가 `data-theme` 없이 의미 토큰만 덮으면(`.promo { --surface: … }`) 그 안의 부품에는 닿지 않는다 — 부품은 `:root`(또는 가장 가까운 `[data-theme]`)에서 풀린 부품 토큰을 읽는다. 구역마다 다른 모양이 필요하면 그 구역에 `data-theme` 테마를 하나 더 둔다.
  - 화면 CSS 가 부품과 같은 모양을 그릴 때 부품 토큰을 **읽는** 것은 된다(`border-radius: var(--card-radius)`).
- 새 손잡이가 필요하면 `tokens.json` 에 한 줄 더하고 그 부품 CSS 가 `var(--<부품>-<이름>)` 을 쓰게 한다. 기본값은 지금 쓰던 의미 토큰 — 화면이 바뀌지 않는다. 아무 부품도 안 쓰는 부품 토큰은 루트 `tests/componentTokens.test.ts` 가 막는다.

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
- 생성 CSS 의 블록: 기본 테마 `:root, [data-theme='light']` · 다른 테마 `[data-theme='<이름>']`(`<html>` 이 아니어도 된다 — 컨테이너에 달면 그 안만 그 테마라 라이트 · 다크를 나란히 보여 줄 수 있다. 컨테이너는 `background: var(--bg); color: var(--text)` 를 직접 건다) · 시스템 `@media (prefers-color-scheme: dark) { :root:not([data-theme='light']) }`. 시스템 블록은 다크 블록과 같은 선언이다(테스트가 대조).
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
3. `pnpm tokens`. 생성 CSS 에 `[data-theme='sepia']` 블록이 생기고 문서 표에 칸이 늘어난다.
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

### Component · Button

| token | light | dark | reference | purpose |
|---|---|---|---|---|
| `--button-radius` | `6px` | = | `--radius-md` | 모서리 — 알약 버튼이면 {semantic.radius.radius-full} 이나 9999px |
| `--button-primary-bg` | `#17201c` | `#e7ece9` | `--inverse` | 주 버튼 채움(Pagination 현재 쪽 포함) |
| `--button-primary-fg` | `#ffffff` | `#111413` | `--on-inverse` | 주 버튼 글자 — primary-bg 를 바꾸면 대비가 맞는 글자색으로 함께 바꾼다 |
| `--button-primary-border` | `#17201c` | `#e7ece9` | `--inverse` | 주 버튼 테두리 |
| `--button-primary-hover-bg` | `#0f766e` | `#5cd6c6` | `--teal` | 주 버튼 hover 채움 |
| `--button-secondary-bg` | `#ffffff` | `#161d1a` | `--surface` | 보조 버튼 · 버튼 모양 부품의 바탕 |
| `--button-secondary-border` | `#b9c4bd` | `#3d4a44` | `--border-strong` | 보조 · 덜 중요한 버튼 · 버튼 모양 부품의 테두리 |
| `--button-hover-wash` | `rgba(15, 118, 110, 0.08)` | `rgba(92, 214, 198, 0.1)` | `--teal-wash` | 보조 · 덜 중요한 버튼 hover 바탕 |
| `--button-hover-border` | `#0f766e` | `#5cd6c6` | `--teal` | 보조 · 버튼 모양 부품 hover 테두리 |
| `--button-quiet-hover-bg` | `#eef2f0` | `#1d2622` | `--surface-muted` | 작은 버튼 모양 부품(CopyButton · RowMenu 단추) hover · 열림 바탕 |
| `--button-quiet-border` | `#d8dfda` | `#2b3631` | `--border` | Pagination 단추 테두리 |
| `--button-backdrop` | `none` | = | `none` | 보조 바탕 뒤 흐림(backdrop-filter) — 유리 면이면 blur(12px) 처럼 날값을 그대로 쓴다 |

Button 과 버튼 모양 부품(CopyButton · Pagination · RowMenu 단추 · Dialog 닫기 · ErrorReference 복사 · SectionCard 접기) — 모두 보조 바탕 · 흐림 · hover 테두리를 같이 쓴다.

### Component · Field

| token | light | dark | reference | purpose |
|---|---|---|---|---|
| `--field-radius` | `6px` | = | `--radius-md` | 모서리 |
| `--field-bg` | `#ffffff` | `#161d1a` | `--surface` | 바탕 |
| `--field-border` | `#d8dfda` | `#2b3631` | `--border` | 테두리 |
| `--field-focus-border` | `#0f766e` | `#5cd6c6` | `--teal` | 포커스 테두리 |
| `--field-focus-ring` | `#dff5f0` | `#12332f` | `--teal-soft` | 포커스 바깥 링(outline) 색 |
| `--field-disabled-bg` | `#eef2f0` | `#1d2622` | `--surface-muted` | 비활성 바탕 |

입력칸 — Input · Select · Textarea · CodeEntry 칸.

### Component · Card

| token | light | dark | reference | purpose |
|---|---|---|---|---|
| `--card-radius` | `6px` | = | `--radius-md` | 모서리 |
| `--card-bg` | `#ffffff` | `#161d1a` | `--surface` | 바탕 — 유리 면이면 반투명 의미 토큰 |
| `--card-border` | `#d8dfda` | `#2b3631` | `--border` | 테두리 |
| `--card-shadow` | `0 18px 45px rgba(36, 47, 43, 0.08)` | `0 18px 45px rgba(0, 0, 0, 0.45)` | `--shadow` | 그림자 |
| `--card-backdrop` | `none` | = | `none` | 바탕 뒤 흐림(backdrop-filter) — 유리 면이면 blur(16px) saturate(1.5) 처럼 날값을 그대로 쓰고 bg 를 반투명 의미 토큰으로 |

면 부품 — Card · SectionCard · Stat · Table 틀(Table 은 그림자 없음).

### Component · Overlay

| token | light | dark | reference | purpose |
|---|---|---|---|---|
| `--overlay-radius` | `6px` | = | `--radius-md` | 모서리 |
| `--overlay-bg` | `#ffffff` | `#161d1a` | `--surface` | 바탕 |
| `--overlay-border` | `#b9c4bd` | `#3d4a44` | `--border-strong` | 테두리 |
| `--overlay-shadow` | `0 18px 45px rgba(36, 47, 43, 0.08)` | `0 18px 45px rgba(0, 0, 0, 0.45)` | `--shadow` | 그림자 |
| `--overlay-backdrop` | `none` | = | `none` | 바탕 뒤 흐림(backdrop-filter) — 유리 면이면 blur(16px) saturate(1.5) 처럼 날값을 그대로 쓰고 bg 를 반투명 의미 토큰으로 |
| `--overlay-item-radius` | `4px` | = | `--radius-sm` | 목록 항목 모서리(Combobox 선택지 · RowMenu 항목) |
| `--overlay-scrim` | `color-mix(in srgb, #17201c 55%, transparent)` | `color-mix(in srgb, #e7ece9 55%, transparent)` | `color-mix(in srgb, var(--inverse) 55%, transparent)` | Dialog 뒤 덮개 |

떠 있는 면 — Dialog · Combobox 목록 · RowMenu 메뉴.

### Component · Shell

| token | light | dark | reference | purpose |
|---|---|---|---|---|
| `--shell-bg` | `rgba(255, 255, 255, 0.92)` | `rgba(15, 20, 18, 0.88)` | `--header-bg` | 바탕 |
| `--shell-border` | `#d8dfda` | `#2b3631` | `--border` | 아래 테두리 |
| `--shell-backdrop` | `none` | = | `none` | 바탕 뒤 흐림(backdrop-filter) — 유리 면이면 blur(16px) saturate(1.5) 처럼 날값을 그대로 쓰고 bg 를 반투명 의미 토큰으로 |
| `--shell-nav-radius` | `6px` | = | `--radius-md` | 내비 링크 · 포커스 링 모서리 |
| `--shell-nav-active-bg` | `rgba(15, 118, 110, 0.08)` | `rgba(92, 214, 198, 0.1)` | `--teal-wash` | 현재 페이지 링크 바탕 |

AppShell 머리줄.

### Component · Progress

| token | light | dark | reference | purpose |
|---|---|---|---|---|
| `--progress-radius` | `9999px` | = | `--radius-full` | 모서리 |
| `--progress-track` | `#d8dfda` | `#2b3631` | `--border` | 바탕 줄 |
| `--progress-fill` | `#0f766e` | `#5cd6c6` | `--teal` | 정해진 진행의 채움 — 색 또는 그라디언트(linear-gradient(…, {semantic.…})). 그라디언트는 채운 폭 안에서만 그려진다 |
| `--progress-indeterminate` | `#0f766e` | `#5cd6c6` | `--teal` | 끝을 모르는 진행의 움직이는 띠 · 브라우저 기본 막대(accent-color) — 색만 |
| `--progress-indeterminate-still` | `rgba(15, 118, 110, 0.08)` | `rgba(92, 214, 198, 0.1)` | `--teal-wash` | 움직임 줄이기 설정에서 끝을 모르는 진행의 바탕 — 색만 |

Progress 막대.

### Component · Choice

| token | light | dark | reference | purpose |
|---|---|---|---|---|
| `--choice-selected-bg` | `rgba(15, 118, 110, 0.08)` | `rgba(92, 214, 198, 0.1)` | `--teal-wash` | 고른 칸 바탕 |
| `--choice-selected-border` | `#0f766e` | `#5cd6c6` | `--teal` | 고른 칸 테두리 |

고른 상태 — ChoiceGroup 칸.

### Component · Switch

| token | light | dark | reference | purpose |
|---|---|---|---|---|
| `--switch-track` | `#b9c4bd` | `#3d4a44` | `--border-strong` | 꺼진 바탕 |
| `--switch-track-on` | `#0f766e` | `#5cd6c6` | `--teal` | 켜진 바탕 |
| `--switch-thumb` | `#ffffff` | `#161d1a` | `--surface` | 손잡이 |

Switch · SwitchRow.

### Component · Badge

| token | light | dark | reference | purpose |
|---|---|---|---|---|
| `--badge-radius` | `9999px` | = | `--radius-full` | 모서리 |

알약 — Badge · SectionIndex 링크.

### Component · Alert

| token | light | dark | reference | purpose |
|---|---|---|---|---|
| `--alert-radius` | `6px` | = | `--radius-md` | 모서리 |

알림 상자 — Alert · FormProblems.

### Component · Tooltip

| token | light | dark | reference | purpose |
|---|---|---|---|---|
| `--tooltip-radius` | `4px` | = | `--radius-sm` | 모서리 |
| `--tooltip-bg` | `#17201c` | `#e7ece9` | `--inverse` | 바탕 |
| `--tooltip-fg` | `#ffffff` | `#111413` | `--on-inverse` | 글자 — bg 와 대비가 맞게 |

Tooltip.

### Component · Avatar

| token | light | dark | reference | purpose |
|---|---|---|---|---|
| `--avatar-radius` | `9999px` | = | `--radius-full` | 모서리 — 사각 아바타면 {semantic.radius.radius-md} |

Avatar.

### Component · Skeleton

| token | light | dark | reference | purpose |
|---|---|---|---|---|
| `--skeleton-bg` | `#eef2f0` | `#1d2622` | `--surface-muted` | 바탕 |

Skeleton(불러오는 자리).

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
