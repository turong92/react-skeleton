# @skeleton/reviews

리뷰 · 평점 사용자 화면 한 벌 — 아무 대상(종류 + id: 상품 · 글 …)에 별점 1~5 · 본문 · 사진. 백엔드 `modules/review`(+ `review-jdbc`)의 사용자 HTTP 짝이다. 운영 화면(신고 큐 · 숨김 · 답글 쓰기)은 선택 하위 경로 `@skeleton/reviews/admin` 에 오며 아직 없다.

```tsx
const api = createReviewsApi(apiClient) // 기본 경로 /reviews
const target = { type: 'product', id: code }

function ProductReviews() {
  const filters = useReviewFilters() // 요약 막대와 목록이 한 조건을 쥔다
  const summary = useReviewSummary(api, target)
  const config = useReviewConfig(api)
  const create = useCreateReview(api, target)
  if (!summary.data || !config.data) return null
  const blocked = writeBlockedMessage(summary.data.writeBlockedReason, labels)
  return (
    <>
      <ReviewSummary
        summary={summary.data}
        rating={filters.params.rating}
        onToggleRating={filters.toggleRating}
        labels={labels}
      />
      {summary.data.canWrite ? (
        <ReviewForm
          config={config.data}
          labels={labels}
          renderPhotos={renderPhotos}
          onSubmit={(input) => create.mutateAsync({ input })}
        />
      ) : (
        blocked && <Alert>{blocked}</Alert>
      )}
      <ReviewList
        api={api}
        target={target}
        labels={labels}
        filters={filters}
        signedIn
        reportReasons={config.data.reportReasons}
      />
    </>
  )
}
```

`QueryClientProvider` 아래에서 쓴다. 문구는 `labels`(영어 기본, `koReviewsLabels`), 일부만 바꾸려면 `resolveReviewsLabels({ … })`. 전체 조립은 스토리 `Packages/reviews/ReviewsPage`.

| 내보내기                                                                                 | 하는 일                                                                                                |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `createReviewsApi(client, { basePath })`                                                 | 호출 모음(아래 표). 경로는 서버 `skeleton.review.http.base-path` 와 맞춘다                             |
| `useReviewConfig` · `useReviewSummary(api, target)` · `useReviews(api, target, params)`  | 서버 설정 · 평균/분포/내 리뷰/쓸 수 있는지 · 한 쪽의 리뷰(조건을 바꾸는 동안 앞 쪽을 남긴다)           |
| `useTargetRatings(api, targets)` · `useMyReviews(api)`                                   | 여러 대상의 별점 한 줄(≤ 50, 목록 화면용) · 내 리뷰(커서)                                              |
| `useCreateReview(api, target)` · `useUpdateReview` · `useRemoveReview`                   | 쓰기 · 고치기 · 지우기 — 성공하면 요약 · 목록 · 내 리뷰를 다시 가져온다(`reviewKeys.all`)              |
| `useSetHelpful(api)` · `useReportReview(api)`                                            | 도움돼요 누르기/떼기(서버가 센 값을 목록 캐시의 그 줄에 꽂는다) · 신고                                 |
| `useReviewFilters(initial?)`                                                             | 목록 조건(정렬 · 별점 · 구매 인증 · 사진 · 쪽) 상태 한 벌. 조건을 바꾸면 첫 쪽                         |
| `RatingStars { value, showValue? }`                                                      | 별점 표시. 별은 장식, 읽는 이름은 「5점 만점에 4.3점」. `null` 이면 「아직 평점이 없어요」             |
| `RatingInput { value, onChange }`                                                        | 별점 고르기 — 라디오 다섯 개의 `fieldset`. Tab 은 한 번, 화살표로 점수 이동                            |
| `ReviewSummary { summary, rating?, onToggleRating? }`                                    | 평균 · 별 · 리뷰 수 + 분포 막대. `onToggleRating` 을 주면 막대가 거르는 단추(다시 누르면 풀림)         |
| `ReviewList { api, target, filters?, signedIn?, reportReasons?, onEdit?, renderPhoto? }` | 가져오기 + 정렬 · 칩 · 쪽 이동 · 도움돼요 · 신고 · 지우기. `ReviewListView` 는 데이터를 받는 순수 모양 |
| `ReviewItem` · `ReportDialog`                                                            | 리뷰 한 줄 · 신고 창(사유 필수 + 자세한 내용). 낱개로도 쓴다                                           |
| `ReviewForm { config, initial?, onSubmit, onCancel?, renderPhotos? }`                    | 쓰기 · 고치기 폼. 별점 필수 · 본문은 다듬은 길이로 서버 한도 검사                                      |
| `writeBlockedMessage(reason, labels)` · `validateReview`                                 | 서버의 `writeBlockedReason` → 문장 · 폼 검사                                                           |

## API (계약: 설계 §A5)

| 호출                                  | 경로                                                                                                          |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `getConfig()`                         | `GET /reviews/config`                                                                                         |
| `getSummary(target)`                  | `GET /reviews/targets/{type}/{id}/summary`                                                                    |
| `listSummaries(targets)`              | `GET /reviews/summaries?targets=product:a,product:b` (≤ 50)                                                   |
| `listReviews(target, params)`         | `GET /reviews/targets/{type}/{id}/reviews?sort&rating&verified&photo&page&size`                               |
| `createReview(target, input, opts?)`  | `POST …/reviews {rating, body, photos?}` + `Idempotency-Key` (409 `REVIEW.ALREADY_WRITTEN` · `REVIEW.LOCKED`) |
| `updateReview(id, patch)`             | `PATCH /reviews/{id}`                                                                                         |
| `removeReview(id)`                    | `DELETE /reviews/{id}` (204)                                                                                  |
| `setHelpful(id, helpful)`             | `PUT` / `DELETE /reviews/{id}/helpful` → `{helpfulCount, helpful}`                                            |
| `reportReview(id, {reason, detail?})` | `POST /reviews/{id}/reports` (204)                                                                            |
| `myReviews(cursor?)`                  | `GET /reviews/me?cursor`                                                                                      |
| `photoPath(id, index)`                | `/reviews/{id}/photos/{index}` — 서버가 `302` 로 짧은 서명 주소에 넘긴다                                      |

- **읽기 공개**: 서버 `skeleton.review.http.allow-anonymous-read` 기본은 꺼짐(요약 · 목록 · 일괄 요약만 켠다). 비로그인 화면은 `signedIn={false}` 로 두면 도움돼요 · 신고 단추가 없다(서버가 401).
- **계정 id 는 어디에도 없다** — 응답의 `authorName` · `authorTag` 만 `이름#꼬리표` 로 그린다. 본문은 글자로만 그린다(HTML 해석 없음).
- **사진**: 올리기는 이 패키지가 모른다. 앱이 `ReviewForm` 의 `renderPhotos({ photos, onChange, max, disabled })` 에 `@skeleton/storage` 업로더를 꽂고 저장 키를 `onChange` 로 돌려준다. 보여 주기는 응답에 저장 키가 없고(`photos: [{index}]`) `photoPath(id, index)` 를 앱이 `<img>` 에 그린다(`ReviewList` 의 `renderPhoto`). 인증 헤더가 필요한 앱은 가져와서 blob 으로 그린다. **고칠 때**는 처음 키 목록을 알 수 없어, 사진 칸을 만졌을 때만 `photos` 가 실린다.
- **내 리뷰**: 서버의 `mine` 으로 판정한다. 운영자가 숨긴 내 리뷰(`status: 'HIDDEN'`)는 「숨겨졌어요 + 사유」 띠와 함께 나만 보이고, 고칠 수 없고 지우기만 된다. 내 리뷰에는 도움돼요를 못 누른다(서버 403) — 숫자만 보인다.
- **눌리는 것은 눌리게**: 별점 칸 · 분포 막대 · 거르기 칩 · 신고 사유는 쉬는 상태에서도 테두리가 있고 44px 이상이며, 눌린 상태는 ✓ · 테두리 · 바탕으로 말한다(색만으로 말하지 않는다).
- 스토리: 부품마다(`RatingStars` · `RatingInput` · `ReviewSummary` · `ReviewItem` · `ReviewList` · `ReviewForm`) + `ReviewsPage`(조립). 가짜 API 는 `src/stories/fakeReviews.ts`.
