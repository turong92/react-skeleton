# showcase

스켈레톤이 주는 것을 **브라우저에서 눌러 보는 갤러리**. 스타터는 일부러 비어 있으니, 기본 세트를 따로 보고 싶을 때 이 앱을 연다. 백엔드가 필요 없다 — 모든 데모가 가짜 전송(주입 가능한 `AuthApi` · `NotificationsApi` · `StorageApi` · `UploadTransport` · `loader` · axios 어댑터) 위에서 돈다.

```bash
pnpm dev:showcase   # http://localhost:5173  (또는 pnpm --filter showcase dev)
```

| 경로               | 내용                                                                                       |
| ------------------ | ------------------------------------------------------------------------------------------ |
| `/ui`              | `@skeleton/ui` 의 모든 부품 · 도우미를 상태별로(기본 · 오류 · 비활성 · 로딩 · 크기 · 변형) |
| `/tokens`          | `tokens.json` 에서 읽은 색 · 간격 · 모서리 · 글자 크기 · 그림자, 라이트와 다크를 나란히    |
| `/packages/<이름>` | 패키지별 사용 데모 + 복사해 쓰는 import 줄                                                 |

키보드만으로 쓸 수 있다(건너뛰기 링크 · `nav`/`main` 랜드마크 · 현재 위치 `aria-current` · 화면을 옮기면 본문으로 포커스). 두 테마에서 같은 토큰으로 칠한다.

## 새 섹션 더하기

- **UI 부품**: `src/ui/entries/*.tsx` 의 배열에 `{ name, title, render }` 한 줄. `@skeleton/ui` 가 부품을 export 하는데 항목이 없으면 `pnpm test` 가 실패한다.
- **패키지**: `src/demos/` 에 데모 하나 + `packageSections.ts` 에 한 줄(주소 · 제목 · import 줄). 앱이 선언한 `@skeleton/*` 패키지에 데모가 없으면 테스트가 실패한다.
- 가짜는 `src/fakes/` — 데모마다 백엔드 없이 도는 이유가 거기 있다.

## 찍어 낸 프로젝트에는 기본으로 안 따라온다

`scripts/new-project.sh <dir> <name> --with-showcase` 일 때만 `apps/showcase` 가 남는다(모든 패키지가 따라온다).
