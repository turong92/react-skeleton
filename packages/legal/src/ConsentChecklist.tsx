import { Button, Checkbox } from '@skeleton/ui'
import type { ConsentRow } from './consentLogic'
import styles from './ConsentChecklist.module.css'
import { mergeLegalLabels, type LegalLabels } from './labels'

export type ConsentChecklistProps = {
  rows: readonly ConsentRow[]
  /** 종류 → 체크 여부 */
  checked: Readonly<Record<string, boolean>>
  onChange: (next: Record<string, boolean>) => void
  /** 줄의 「보기」 — 문서를 다이얼로그 · 새 화면으로 연다(앱이 정한다) */
  onOpen?: (row: ConsentRow) => void
  /** 필수 줄이 체크 안 된 채 제출을 시도했다 — 그 줄에 오류를 보인다 */
  showError?: boolean
  disabled?: boolean
  /** 「전체 동의」 줄을 보일지(기본 true, 줄이 둘 이상일 때만) */
  agreeAll?: boolean
  labels?: Partial<LegalLabels>
}

/**
 * 동의 체크리스트 — 필수 · 선택 줄 + 「전체 동의」(일부만이면 `mixed`). 줄마다 문서 「보기」.
 * 체크 상태는 부모가 쥔다(가입 폼 · 재동의 화면이 같은 부품을 쓴다). 서버로 보낼 값은 `consentRequestsOf(rows, checked)`.
 */
export function ConsentChecklist({
  rows,
  checked,
  onChange,
  onOpen,
  showError,
  disabled,
  agreeAll = true,
  labels: given,
}: ConsentChecklistProps) {
  const labels = mergeLegalLabels(given)
  const count = rows.filter((r) => checked[r.type]).length
  const all = rows.length > 0 && count === rows.length
  const some = count > 0 && !all
  const set = (value: boolean) => onChange(Object.fromEntries(rows.map((r) => [r.type, value])))
  return (
    <div className={styles.root}>
      {agreeAll && rows.length > 1 && (
        <Checkbox
          className={styles.all}
          label={labels.agreeAll}
          description={labels.agreeAllHint}
          checked={all}
          indeterminate={some}
          disabled={disabled}
          onChange={(event) => set(event.target.checked)}
        />
      )}
      <ul className={styles.list}>
        {rows.map((row) => {
          const required = row.kind === 'required'
          const missing = showError && required && !checked[row.type]
          return (
            <li key={row.type} className={styles.row} data-invalid={missing || undefined}>
              <Checkbox
                label={
                  <>
                    <span className={required ? styles.tagRequired : styles.tag}>
                      [{required ? labels.required : labels.optional}]
                    </span>{' '}
                    {row.title}
                  </>
                }
                checked={!!checked[row.type]}
                disabled={disabled}
                error={missing ? labels.requiredError : undefined}
                onChange={(event) => onChange({ ...checked, [row.type]: event.target.checked })}
              />
              {onOpen && (
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={labels.view(row.title)}
                  onClick={() => onOpen(row)}
                >
                  {labels.viewShort}
                </Button>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
