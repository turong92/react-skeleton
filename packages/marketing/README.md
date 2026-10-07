# @skeleton/marketing

공개 페이지(랜딩 · 요금제 · 약관 · 404/500/점검)를 **조립하는 부품**. `@skeleton/ui` 부품으로만 짜고(날 요소 · 날값 없음) 글자는 모두 prop 이다 — 앱이 번역 사전(`@skeleton/i18n`)에서 넘긴다. 백엔드가 필요 없고 **추적 코드가 없다**.

## 왜 `@skeleton/ui` 가 아니라 별도 패키지인가

`ui` 는 어느 앱에나 들어가는 **낱개 부품**(버튼 · 입력 · 표)이다. 이 패키지는 한 페이지의 **구역**(Hero · 요금제 · 푸터)과 그 구역이 쓰는 클라이언트 저장소(동의)다 — 로그인 뒤 앱(대시보드 · 내부 도구)에는 필요 없다. 별도라서 `new-project.sh --packages marketing` 으로 고른 프로젝트에만 따라가고 나머지 프로젝트의 `ui` 는 가볍게 남는다. Patterns(복사해 시작하는 화면 틀)도 이 패키지 옆(`src/patterns/`)에 있어 패키지와 함께 간다.

| export                                                                | 뜻                                                                                                                                                                                                        |
| --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Hero` · `FeatureGrid` · `Testimonial` · `CtaBand`                    | 랜딩 구역. 제목 단계(`headingLevel`)로 페이지의 `h1` 하나 → `h2` 구역 순서를 지킨다                                                                                                                       |
| `FaqAccordion`                                                        | 네이티브 `<details>`(스크립트 없이 · 키보드 그대로). `exclusive` 면 하나를 열면 나머지가 닫힌다                                                                                                           |
| `PricingTable` + `PricingPlan` · `formatPrice` · `savingsPercent`     | 요금제를 **데이터**로. 월/연 토글(연 결제는 한 달 값 + 연 총액 + 절약 %), `highlighted`, 0원 · 맞춤 가격(`price: null`). 통화 · 로케일을 명시한다(서버 렌더와 같아야 한다)                                |
| `SiteFooter`                                                          | 브랜드 · 열별 링크 · 법적 링크 · 저작권 · `extra`(쿠키 설정). `AppShell` 의 `footer` 안에 넣는다(요소를 더하지 않는다)                                                                                    |
| `createConsentStore` · `useConsent` · `ConsentBanner`                 | 동의 선택 저장소(`localStorage` · 구독 · `onChange` · 버전이 바뀌면 다시 묻기 · 필수 범주는 못 끈다)와 배너(거부 = 허용과 같은 무게 · 서버에는 그리지 않는다). 허용된 곳에서만 앱이 자기 분석 코드를 켠다 |
| `LegalDocumentPage` + `LegalVersion` · `currentVersionOf`             | 판마다 마크다운 + 효력일 · 판 바꾸기 · 「현재 판 아님」 안내 · `templateNotice` · `{{키}}` 채우기(`MarkdownView`)                                                                                         |
| `StatusPage` · `NotFoundPage` · `ServerErrorPage` · `MaintenancePage` | 404 · 500(참조 번호) · 점검(돌아올 시각)                                                                                                                                                                  |

Patterns: `Patterns/Landing` · `Patterns/Pricing` · `Patterns/LegalDocument` · `Patterns/NotFound`(`src/patterns/*.stories.tsx` — 복사해서 문구만 바꾼다).

## 쓰는 법

```tsx
<PricingTable plans={plans} interval={interval} onIntervalChange={setInterval} currency="KRW" locale="ko-KR"
  labels={{ monthly: t('pricing.monthly'), yearly: t('pricing.yearly'), … }} onSelect={(plan, interval) => navigate(`/signup?plan=${plan.id}&billing=${interval}`)} />

const consent = createConsentStore({ categories: ['necessary', 'analytics'], version: '2026-10', onChange: (s) => s.choices.analytics ? startAnalytics() : stopAnalytics() })
<ConsentBanner store={consent} categories={[{ id: 'necessary', label: '…', required: true }, { id: 'analytics', label: '…' }]} />
// 배너가 떠 있는 동안 페이지 아래를 배너 높이만큼 비운다(`reserveSpace`, 기본 켜짐 — 끄면 겹친다):
// body padding-bottom + html scroll-padding-bottom 이라 맨 끝까지 스크롤하면 폼 · 오류 · 제출 버튼이 배너 위에 오고, focus / scrollIntoView 도 배너 밑으로 숨지 않는다
// 푸터의 「쿠키 설정」: <Button onClick={() => consent.reset()}>…</Button>
```

## 규칙

- 서버 렌더에서 `ConsentBanner` 는 아무것도 그리지 않는다(방문자의 선택을 모르니). `MaintenancePage` 의 시각은 시간대 · 로케일을 주면 바로, 안 주면 이어받은 뒤에 그린다.
- 법적 문서는 **법률 검토를 거친 것만** 공개한다. 이 스켈레톤이 주는 문서는 템플릿이고 `templateNotice` 로 눈에 띄게 표시한다. `{{키}}` 가 남으면 노란 표시가 그대로 보인다.
- 날짜는 `@skeleton/time`(달력 날짜는 시간대 변환 없음). 의존: `@skeleton/ui` · `@skeleton/time`.
