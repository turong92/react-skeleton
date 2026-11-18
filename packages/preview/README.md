# @skeleton/preview

기기 틀(폰 · 태블릿 세로/가로 · PC) 안에 화면을 그리는 미리보기 부품. 편집 화면 옆 「이렇게 보여요」 무대(`PreviewStage`)와, 방문자처럼 크게 보는 전체 화면(`PreviewViewer` — 기기 넷 · 배율 · 끌기 · 만지기 · 다시 재생 · 새 창)을 한 벌로 준다.

무대 · 뷰어는 화면 안에 무엇이 그려지는지 모른다 — `PreviewSource` 하나를 받는다. iframe 으로 그리는 앱은 `{ kind: 'frame', bridge }`, 같은 번들의 컴포넌트를 바로 그리는 앱은 `{ kind: 'render', content }`. 메시지 규약 · 보기 조건 같은 앱 개념은 앱이 다리(`PreviewFrameBridge`)와 `extra` 칸으로 꽂는다. 상태: **experimental**(앱 둘이 아직 갈아타지 않아 계약이 바뀔 수 있다).

## API

| export                                               | 뜻                                                                                                                                                                                                                                                       |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PreviewStage`                                       | 기기 하나를 틀에 담아 칸에 맞춘다 — `source` · `device` · `pcWidth` · `pcZoom` · `phone` · `bare` · `fitHeight` · `fluid` · `scrollBox` · `maxScale` · `focusable` · `labels` …                                                                          |
| `PreviewViewer`                                      | 방문자처럼 크게 보기 — `as="dialog"`(전체 화면 모달) 또는 `"page"`(새 창 화면). 넓은 결 막대 · 좁은 결 알약 → 판 · 배율 패드 · 꽉 찬 폰                                                                                                                  |
| `DevicePicker`                                       | 기기 넷 고르기 단추 묶음(`value` · `onChange`) — 큰 견본에서 「그 기기의 크게 보기 열기」에 쓴다                                                                                                                                                         |
| `PREVIEW_SANDBOX`                                    | iframe 기본 `sandbox` 값(`allow-scripts` — 안쪽 문서가 바깥 주소 · 저장소 · 쿠키를 못 읽는다)                                                                                                                                                            |
| `defaultPreviewLabels` · `koPreviewLabels`           | 화면 문구(기본 영어 · 한국어). 타입 `PreviewLabels`                                                                                                                                                                                                      |
| `PREVIEW_DEVICES` · `PC_WIDTHS` · `DEFAULT_PC_WIDTH` | 기기 넷 `phone` · `tabletPortrait` · `tabletLandscape` · `pc`(고르는 순서) / PC 폭 1280 · 1440 · 1920(높이 800 · 900 · 1080), 기본 1280                                                                                                                  |
| `deviceViewport(device, pcWidth?)`                   | 기기의 CSS 뷰포트 `{ width, height, frame }`                                                                                                                                                                                                             |
| `outerSize(device, pcWidth?, kind?)`                 | 틀까지 넣은 바깥 크기(PC 폭은 받침까지) — 칸 폭을 잡을 때                                                                                                                                                                                                |
| 타입                                                 | `PreviewDevice` · `PcWidth` · `FrameKind` · `PcZoom` · `PreviewSource` · `PreviewFrameSource` · `PreviewRenderSource` · `PreviewFrameBridge` · `PreviewStageProps` · `PreviewViewerProps` · `PreviewViewerExtra` · `DevicePickerProps` · `PreviewLabels` |

앱에 요구하는 것: `@skeleton/ui`(Button · Select · SwitchRow · Dialog) 와 `@skeleton/tokens` 의 토큰(`--device-*` 는 기기 틀 색 · 모서리 — 값을 바꾸려면 `tokens.json` 으로 덮는다), 피어 `lucide-react`(아이콘) · `react`. `as="dialog"` 는 `onClose` 안에서 뷰어를 내려야 한다(Esc · 닫기 단추 모두 `onClose` 만 부른다 — 열림 상태는 부모가 쥔다).

## iframe 으로 그릴 때

앱의 제어기(메시지를 보내고 받는 객체)를 `PreviewFrameBridge` 로 감싼다. `attach` 만 필수고, 나머지(높이 · 모달 · 스크롤 · 두 겹)는 있으면 그 기능이 켜지고 없으면 꺼질 뿐 무대는 그대로 그려진다. 이름이 다른 메서드를 잇는 게터 객체로 만들고, 다리는 `useState(() => …)` 로 한 번만 만든다(무대는 바뀐 다리를 받으면 떼고 다시 붙인다).

```tsx
import { PreviewStage, type PreviewFrameBridge } from '@skeleton/preview'

function createBridge(controller: MyController): PreviewFrameBridge {
  return {
    attach: (frame) => controller.attach(frame), // 돌려주는 함수로 뗀다
    get contentHeight() {
      return controller.documentHeight // 알면 phone · bare · scrollBox 배치가 iframe 을 이 높이로 편다
    },
    onHeight: (listener) => controller.onHeight(listener),
  }
}

function Editor() {
  const [bridge] = useState(() => createBridge(new MyController('https://example.com/preview')))
  return <PreviewStage source={{ kind: 'frame', bridge }} device="phone" fitHeight />
}
```

`PreviewViewer` 는 자기 화면을 따로 받는다 — 편집기 미리보기와 같은 iframe 을 같이 쓰면 「방문자처럼 보기」 · 다시 재생이 새어 나가므로, 앱이 뷰어용 다리를 따로 만들어 같은 문서를 싣는다.

## 직접 그릴 때

같은 번들의 컴포넌트를 `content` 로 넘기면 화면 상자(기기 뷰포트 크기) 안에 그대로 그려진다. 기기를 바꿔도 내용은 다시 마운트되지 않아 상태(재생 위치 · 펼침)가 남는다.

```tsx
<PreviewStage source={{ kind: 'render', content: <Screen /> }} device="tabletLandscape" />
```

- 크게 보기를 연 동안 안쪽 무대에는 자리 글을 `content` 로 넘긴다 — 같은 화면이 두 곳에서 돌아 재생 · 소리가 두 벌 되지 않게(패키지는 `content` 를 한 곳에만 그린다).
- 내용은 창 폭 `@media` · `vh` 가 아니라 `@container` · 놓인 칸 높이로 반응해야 기기를 따른다(화면 상자 폭 · 높이 = 기기 뷰포트).
- 내용의 `position: fixed`(시트 · 모달)는 화면 상자 안에 묶인다.

## 편집기 칸 · 큰 견본

- 편집기 칸: 칸 폭 = `outerSize(device, pcWidth).width`(+ 세로 막대) 로 잡고 무대를 그 안에 둔다. 폰 배치는 `phone` + `headOffset`(문서 위 고정 머리 줄 높이).
- 큰 견본: `<PreviewStage maxScale={1.5} focusable={false} fitHeight … />` + `<DevicePicker onChange={(d) => 그 기기로 크게 보기 열기} />`.
- 크게 보기에 앱 보기 조건(단계 · 언어 · 보는 사람 같은)을 꽂으려면 `extra={{ bar, panel, summary }}` — 막대 · 판 · 알약 요약에 앱의 `Select` · 칩 · 글 조각을 넣는다.

## 문구

```tsx
import { koPreviewLabels, defaultPreviewLabels } from '@skeleton/preview'

<PreviewViewer labels={koPreviewLabels} … />
<PreviewViewer labels={{ ...defaultPreviewLabels, replay: 'Play again' }} … />
```

## 하지 않는 것

- 두 앱 쪽 교체(import 바꾸기 · 옛 파일 지우기) — 이 패키지 밖.
- 메시지 규약 · iframe 제어기 구현 — 앱이 `PreviewFrameBridge` 를 구현한다. 패키지는 규약을 모른다.
- 보기 조건(단계 · 언어 · 보는 사람) 고르기 — 앱이 `extra.bar` · `extra.panel` · `extra.summary` 로 꽂는다.
- 뒤로 가기(history)로 판 · 뷰어 닫기 — 겹 스택이 모듈 전역이라 패키지 규칙에 걸린다. Esc · 단추로만 닫는다.
- 직접 렌더 갈래의 펴기(문서 높이로 늘리기) · 모달 창 맞추기 · 구역 스크롤 — 쓰는 곳이 iframe 앱뿐이다.
- 새 창 미리보기 라우트 — `as="page"` 화면 부품만 준다. 라우트 · 창 열기는 앱.
- 기기 목록 · 배율 단계 · 브레이크포인트 바꾸기, 테마 prop(토큰으로 덮는다).
