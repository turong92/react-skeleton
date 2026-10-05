# @skeleton/tokens

디자인 토큰의 **정본 + 생성기 + 생성물**. 스켈레톤은 메커니즘만 주고, 색 · 서체 취향은 이 스켈레톤에서 시작한 프로젝트가 정한다.

```
packages/tokens/
├── tokens.json    # 정본 — W3C Design Tokens 초안 형식($value · $type · $description, 참조 {경로}). 여기만 고친다
├── build.mjs      # 생성기(의존성 없음) — tokens.json → tokens.css (+ 선택: 문서의 표 구역)
├── build.d.mts    # build.mjs 의 타입
├── tokens.css     # 생성물(손대지 않음) — 라이트/다크 CSS 변수
└── src/           # 토큰 층을 지키는 테스트가 쓰는 도구(색 대비 · 날 색 탐지 · 테마별 변수 표)
```

## 쓰는 법

```ts
import '@skeleton/tokens/tokens.css' // main.tsx 맨 앞 — 다른 CSS 보다 먼저
```

```bash
pnpm tokens         # tokens.json → tokens.css (+ docs/design-tokens.md 표 구역)을 다시 쓴다
pnpm tokens:check   # 쓰지 않고 비교, 어긋나면 종료 코드 1 (CI). 모르는 인자는 사용법 + 종료 코드 2
```

## 공개 표면

| export                         | 뜻                                                                                                           |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `@skeleton/tokens/tokens.css`  | 생성된 스타일시트(`:root` 라이트 · `html[data-theme='dark']` · 시스템 다크)                                  |
| `@skeleton/tokens/tokens.json` | 정본                                                                                                         |
| `@skeleton/tokens/build`       | `build(options)` · `check(options)` · `main(argv)` · `resolveTokens(json)`                                   |
| `@skeleton/tokens`             | 테스트 도구: `themeVars` · `expandVars` · `parseColor` · `over` · `contrast` · `findRawColors` · `cssBlocks` |

### 경로는 옵션이다

`build({ root, source, cssOut, docOut, write })` — 경로는 모두 `root`(기본: 이 패키지 폴더) 기준 상대 경로. `docOut` 을 주지 않으면 문서는 건드리지 않는다.
명령줄도 같다: `node build.mjs [--check] [--source <json>] [--css <file>] [--doc <md>]`. 이 레포는 `--doc ../../docs/design-tokens.md` 로 문서 표를 함께 만든다(패키지의 `tokens` 스크립트).

## 지키는 것 (테스트)

- 생성물이 정본과 같다 · 정본 형식 · 층은 둘(`--p-*` 원시 → 의미) · 의미 토큰은 참조만 · 생성기 CLI(`packages/tokens/src`)
- 날 색 금지 · `--p-*` 직접 사용 금지 · 쓰는 `var(--x)` 는 모두 정의됨 · 글자/바탕 짝 WCAG AA — 두 앱과 모든 패키지의 CSS · TSX 를 훑는다(루트 `tests/`)

규칙 · 토큰/테마 추가법 · 생성된 표: [`docs/design-tokens.md`](../../docs/design-tokens.md)
확장 키는 중립 이름 `$extensions.skeleton`. 바꾸려면 `build.mjs` 의 `EXT` 와 `tokens.json` 을 함께.
