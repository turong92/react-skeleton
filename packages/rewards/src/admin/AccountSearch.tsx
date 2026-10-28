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
  labels?: Partial<RewardsAdminLabels>
}

/**
 * 계정 찾기 - 이메일 · 로그인 아이디로 검색해 결과 줄에서 하나를 고른다. 계정 id 를 직접 적는 칸이 없다.
 * 결과가 없으면 「찾는 계정이 없어요」, 실패하면 다시 해 보라는 안내
 */
export function AccountSearch({ search, onPick, labels: given }: AccountSearchProps) {
  const t = mergeAdminLabels(given).accountSearch
  const [draft, setDraft] = useState('')
  const found = useMutation({ mutationFn: (query: string) => search(query), retry: false })

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
        >
          {t.submit}
        </Button>
      </form>
      {found.isError && <Alert tone="danger">{t.failed}</Alert>}
      {found.isSuccess &&
        (found.data.length === 0 ? (
          <p className={styles.muted}>{t.noResult}</p>
        ) : (
          <ul className={styles.results} aria-label={t.results}>
            {found.data.map((account) => (
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
    </div>
  )
}
