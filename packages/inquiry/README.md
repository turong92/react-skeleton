# @skeleton/inquiry

문의 · 의견 받기 사용자 화면 — 백엔드 `modules/inquiry`(+ `inquiry-jdbc`)의 짝. 한 줄 폼(종류 · 내용 · 답장 받을 이메일)으로 질문 · 제안 · 오류 신고를 받는다. 로그인 없이도 되고, 로그인했으면 클라이언트가 붙인 토큰으로 계정이 붙는다.

| 내보내기                                                            | 하는 일                                                                                                                                                    |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `createInquiryApi(client, { basePath? })`                           | `send(input)` → `POST /inquiries`(202). 공백을 떼고 빈 선택 칸은 보내지 않는다. 기본 경로는 백엔드 모듈이 여는 `/api/v1/inquiries`                         |
| `useInquiryForm(api, options)`                                      | 폼 상태 · 검증 · 전송. 문구를 모르고, 오류는 갈래(`invalid` · `captcha` · `tooMany` · `other`)만 돌려준다. 틀린 곳은 한 번 보내 보려 한 뒤부터             |
| `ContactForm`                                                       | 종류(`ChoiceGroup`) · 내용 · 이메일 · 앱이 꽂는 사람 확인 · 고지 자리(`beforeSubmit`). 보낸 뒤 `onSent({ hasEmail })` — 「잘 받았어요」 화면은 앱이 정한다 |
| `FaqList`                                                           | 자주 묻는 질문 접기 목록(`<details>`). 질문 · 답은 앱이 `sections` 로 준다                                                                                 |
| `inquiryProblem(error)` · `inquiryFieldProblems(input)`             | 실패 · 칸 검사를 한 낱말로                                                                                                                                 |
| `defaultInquiryLabels` · `koInquiryLabels` · `resolveInquiryLabels` | 문구(영어 기본 · 한국어) — 일부만 바꿀 수 있다                                                                                                             |

```tsx
const inquiryApi = createInquiryApi(apiClient)

// 로그인하지 않은 사람에게 서버가 사람 확인(Turnstile)을 켜 뒀다면 — 위젯은 `@skeleton/captcha-turnstile`
const turnstile = useTurnstileToken()
<ContactForm
  api={inquiryApi}
  lang="ko"
  context="screen:help"
  signedIn={Boolean(principal)}
  defaultEmail={verifiedEmail}
  captcha={principal ? undefined : { token: turnstile.token, reset: turnstile.reset, widget: <Turnstile siteKey={siteKey} {...turnstile.widgetProps} /> }}
  onSent={() => setSent(true)}
/>
```

- 백엔드 사람 확인은 기본이 **통과**다. 켜지 않았다면 `captcha` 를 주지 않는다(서버가 토큰을 보지 않는다).
- `context` 는 앱이 붙이는 ≤100자 문자열이다(어느 화면에서 왔는지) — 서버는 뜻을 모르고 운영자 목록에 그대로 보인다.
- 오류 코드는 `INQUIRY.INVALID` · `INQUIRY.CAPTCHA_FAILED` · `INQUIRY.TOO_MANY`(`@skeleton/api-client` 의 `ErrorCodes`).
- 운영자 화면(목록 · 처리 표시)은 이 패키지에 없다 — 서버의 `GET /api/v1/admin/inquiries` · `PUT …/{id}/status` 를 앱이 `Table` 로 만든다.
- 스토리: `Packages/inquiry/ContactForm` · `Packages/inquiry/FaqList`.
