# design/

디자인 토큰의 **정본과 생성기**. 스켈레톤은 메커니즘만 주고, 색 · 서체 취향은 이 스켈레톤에서 시작한 프로젝트가 정한다.

```
design/tokens/
├── tokens.json    # 정본 — W3C Design Tokens 초안 형식($value · $type · $description, 참조 {경로}). 여기만 고친다
├── build.mjs      # 생성기(의존성 없음) — tokens.json → src/styles/tokens.css + docs/design-tokens.md 표 구역
└── build.d.mts    # 테스트가 build.mjs 를 import 할 때 쓰는 타입
```

```bash
pnpm tokens         # 생성물을 다시 쓴다
pnpm tokens:check   # 쓰지 않고 비교, 어긋나면 종료 코드 1 (CI 에서 돈다). 모르는 인자는 사용법 + 종료 코드 2
```

- 생성물(`src/styles/tokens.css`, `docs/design-tokens.md` 의 `<!-- tokens:start -->` … `<!-- tokens:end -->`)은 손으로 고치지 않는다. 고치면 `pnpm test` · `pnpm tokens:check` 가 빨갛게 된다.
- 층 · 이름 규칙 · 토큰/테마 추가 · 프로젝트가 색을 바꾸는 법은 [`docs/design-tokens.md`](../docs/design-tokens.md).
- 확장 키는 중립 이름 `$extensions.skeleton`. 바꾸려면 `build.mjs` 의 `EXT` 와 `tokens.json` 을 함께.
- 미리보기 페이지는 두지 않았다(견본을 부품 층에 기대어 그리는 구조라 부품 층 없는 스켈레톤에는 맞지 않는다). 값은 생성된 표(`docs/design-tokens.md`)로 본다.
