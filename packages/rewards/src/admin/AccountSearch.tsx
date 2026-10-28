import { ApiRequestError } from '@skeleton/api-client'
import { Alert, Button, Field, Input } from '@skeleton/ui'
import { useMutation } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { mergeAdminLabels } from './adminErrors'
import { accountLabelOf, type AccountChoice } from './accountLabel'
import type { RewardsAdminLabels } from './labels'
import styles from './AccountSearch.module.css'

export type AccountSearchProps = {
  /**
   * 글자로 계정을 찾는다 - 앱이 준다(이 패키지는 계정 모듈을 모른다). 보통 `@` 가 있으면 이메일, 없으면 로그인 아이디로 부른다.
   * 실패하면 던진다
   */
  search: (query: string) => Promise<AccountChoice[]>
  /** 고른 계정 */
  onPick: (account: AccountChoice) => void
  /**
   * 한 번에 보이는 결과 수(기본 10). `search` 가 이보다 하나 더 주면 「더 좁혀 주세요」 - 그만큼 가져와서 넘치는지 안다
   */
  limit?: number
  labels?: Partial<RewardsAdminLabels>
}

/**
 * 계정 찾기 - 이메일 · 로그인 아이디로 검색해 결과 줄에서 하나를 고른다. 계정 id 를 직접 적는 칸이 없다.
 * 결과가 없으면 「찾는 계정이 없어요」, 실패하면 다시 해 보라는 안내
 */
export function AccountSearch({ search, onPick, limit = 10, labels: given }: AccountSearchProps) {
  const all = mergeAdminLabels(given)
  const t = all.accountSearch
  const [draft, setDraft] = useState('')
  // 403(계정 조회 권한 없음) · 404(계정 도구가 꺼진 서버)는 이 화면이 제자리에서 말한다 - 전역 오류 토스트를 막는다
  const found = useMutation({
    mutationFn: (query: string) => search(query),
    retry: false,
    meta: { quietStatuses: [403, 404] },
  })
  const denied =
    found.error instanceof ApiRequestError && [403, 404].includes(found.error.apiError.status)

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const query = draft.trim()
    if (query) found.mutate(query)
  }

  return (
    <div className={styles.search}>
      <form className={styles.form} onSubmit={submit}>
        <Field label={t.label} hint={t.hint}>
          {(control) => (
            <Input
              {...control}
              value={draft}
              autoComplete="off"
              spellCheck={false}
              onChange={(event) => setDraft(event.target.value)}
            />
          )}
        </Field>
        <Button
          type="submit"
          variant="secondary"
          disabled={draft.trim() === ''}
          loading={found.isPending}
          loadingLabel={all.loading}
        >
          {t.submit}
        </Button>
      </form>
      {found.isError && (
        <Alert tone={denied ? 'warning' : 'danger'}>{denied ? t.needsPermission : t.failed}</Alert>
      )}
      {found.isSuccess &&
        (found.data.length === 0 ? (
          <p className={styles.muted}>{t.noResult}</p>
        ) : (
          <ul className={styles.results} aria-label={t.results}>
            {found.data.slice(0, limit).map((account) => (
              <li key={account.id}>
                <Button
                  variant="secondary"
                  aria-label={t.pick(accountLabelOf(account))}
                  onClick={() => onPick(account)}
                >
                  <span className={styles.account}>
                    <strong>{accountLabelOf(account)}</strong>
                    {account.loginId && account.email && (
                      <span className={styles.muted}>{account.loginId}</span>
                    )}
                  </span>
                </Button>
              </li>
            ))}
          </ul>
        ))}
      {found.isSuccess && found.data.length > limit && <p className={styles.muted}>{t.tooMany}</p>}
    </div>
  )
}
