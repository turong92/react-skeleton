import { Button, Switch } from '@skeleton/ui'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import type { ConsentStore } from './consentStore'
import styles from './ConsentBanner.module.css'
import { reserveBottomSpace } from './reserveSpace'
import { useConsent } from './useConsent'

export type ConsentCategoryInfo = {
  id: string
  label: string
  description?: string
  /** 끌 수 없는 범주(로그인 유지 같은 꼭 필요한 것) */
  required?: boolean
}

export type ConsentBannerLabels = {
  title: string
  description: string
  acceptAll: string
  rejectAll: string
  customize: string
  save: string
  /** 필수 범주 옆의 「항상 켜짐」 */
  alwaysOn: string
}

const DEFAULT_LABELS: ConsentBannerLabels = {
  title: 'Cookies and privacy',
  description: 'We use cookies to keep the site working. You decide about the rest.',
  acceptAll: 'Accept all',
  rejectAll: 'Reject all',
  customize: 'Choose',
  save: 'Save choices',
  alwaysOn: 'Always on',
}

export type ConsentBannerProps = {
  store: ConsentStore
  categories: ConsentCategoryInfo[]
  labels?: Partial<ConsentBannerLabels>
  /** 개인정보 처리방침 링크 */
  policyLink?: ReactNode
  /**
   * 배너가 떠 있는 동안 페이지 아래를 배너 높이만큼 비워 둔다(기본 true) — 맨 끝까지 스크롤하면 폼 · 오류 문구 · 제출 버튼이 모두 배너 위에 오고,
   * `focus` · `scrollIntoView` 도 배너 밑으로 숨지 않는다(`html` 의 `scroll-padding-bottom`). 끄면 배너는 그대로 위에 겹친다.
   */
  reserveSpace?: boolean
}

/**
 * 동의 배너 — 방문자가 아직 고르지 않았을 때만 화면 아래에 뜬다(서버 렌더 · 하이드레이션 첫 그림에는 없다: 선택을 모르니 깜박이지 않게).
 * 「모두 거부」 와 「모두 허용」 은 같은 무게의 버튼이다(거부를 숨기지 않는다). 「선택」 은 범주별 스위치를 펼치고 필수 범주는 끌 수 없다.
 * 모달이 아니라 `region` 이라 페이지를 막지 않는다. 선택은 `store` 가 저장하고 `store.onChange` 가 앱의 분석 코드를 켠다 — 이 부품은 추적을 하지 않는다.
 */
export function ConsentBanner({
  store,
  categories,
  labels: given,
  policyLink,
  reserveSpace = true,
}: ConsentBannerProps) {
  const labels = { ...DEFAULT_LABELS, ...given }
  const state = useConsent(store)
  const titleId = useId()
  const [choosing, setChoosing] = useState(false)
  const [draft, setDraft] = useState<Record<string, boolean>>({})
  const ref = useRef<HTMLElement>(null)
  const shown = state.status === 'undecided'
  useEffect(() => {
    const banner = ref.current
    if (!shown || !reserveSpace || !banner) return
    // 배너 높이 + 화면 아래에서 띄운 간격(`bottom`)
    const height = () =>
      Math.ceil(
        banner.getBoundingClientRect().height + (parseFloat(getComputedStyle(banner).bottom) || 0),
      )
    const space = reserveBottomSpace(
      { body: document.body, root: document.documentElement },
      height(),
    )
    const watcher =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => space.set(height()))
    watcher?.observe(banner)
    return () => {
      watcher?.disconnect()
      space.release()
    }
  }, [shown, reserveSpace])
  if (state.status !== 'undecided') return null
  const on = (category: ConsentCategoryInfo) => category.required || (draft[category.id] ?? false)

  return (
    <section ref={ref} className={styles.banner} role="region" aria-labelledby={titleId}>
      <div className={styles.text}>
        <h2 id={titleId} className={styles.title}>
          {labels.title}
        </h2>
        <p>
          {labels.description} {policyLink}
        </p>
      </div>
      {choosing && (
        <ul className={styles.categories}>
          {categories.map((category) => (
            <li key={category.id}>
              <Switch
                label={
                  category.required ? `${category.label} (${labels.alwaysOn})` : category.label
                }
                description={category.description}
                checked={on(category)}
                disabled={category.required}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, [category.id]: event.target.checked }))
                }
              />
            </li>
          ))}
        </ul>
      )}
      <div className={styles.actions}>
        <Button variant="secondary" onClick={() => store.rejectAll()}>
          {labels.rejectAll}
        </Button>
        {choosing ? (
          <Button variant="secondary" onClick={() => store.save(draft)}>
            {labels.save}
          </Button>
        ) : (
          <Button variant="ghost" aria-expanded={false} onClick={() => setChoosing(true)}>
            {labels.customize}
          </Button>
        )}
        <Button variant="secondary" onClick={() => store.acceptAll()}>
          {labels.acceptAll}
        </Button>
      </div>
    </section>
  )
}
