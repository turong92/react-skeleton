# @skeleton/preview

기기 틀(폰 · 태블릿 세로/가로 · PC) 안에 화면을 그리는 미리보기 부품. 이 작업(1)은 바탕만 둔다 — 기기 치수 · 틀 · 배율 계산과 기기 틀 토큰. 무대(`PreviewStage`)와 크게 보기(`PreviewViewer`)는 이어지는 작업에서 더해진다.

## API

| export                                         | 뜻                                                                               |
| ---------------------------------------------- | -------------------------------------------------------------------------------- |
| `PREVIEW_DEVICES`                              | 기기 넷 `phone` · `tabletPortrait` · `tabletLandscape` · `pc` — 고르는 단추 순서 |
| `PC_WIDTHS` · `DEFAULT_PC_WIDTH`               | PC 폭 1280 / 1440 / 1920(높이 800 / 900 / 1080), 기본 1280                       |
| `deviceViewport(device, pcWidth?)`             | 기기의 CSS 뷰포트 `{ width, height, frame }`                                     |
| `outerSize(device, pcWidth?, kind?)`           | 틀까지 넣은 바깥 크기(PC 폭은 받침까지) — 칸 폭을 잡을 때                        |
| 타입 `PreviewDevice` · `PcWidth` · `FrameKind` |                                                                                  |

기기 틀 색 · 모서리는 `@skeleton/tokens` 의 `--device-*` 로 덮는다.
