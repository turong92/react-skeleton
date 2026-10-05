import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { Input } from '../Input/Input'
import styles from './Combobox.module.css'
import {
  createRequestGuard,
  filterOptions,
  nextActiveIndex,
  type ComboboxOption,
} from './comboboxLogic'

export type { ComboboxOption } from './comboboxLogic'

export type ComboboxProps = {
  /** `Field` 이 주는 것들 */
  id?: string
  'aria-describedby'?: string
  invalid?: boolean
  /** 지금 고른 것(제어) — 입력칸에는 이 라벨이 보인다 */
  selected: ComboboxOption | null
  onSelect: (option: ComboboxOption | null) => void
  /** 정해진 목록 — 입력한 글로 안에서 거른다 */
  options?: ComboboxOption[]
  /** 서버에서 찾는 목록 — 질의마다 부른다(지연 · 중복 요청 취소 · 늦게 온 옛 응답 버림). `options` 와 둘 중 하나 */
  loadOptions?: (query: string, signal: AbortSignal) => Promise<ComboboxOption[]>
  /** 입력을 멈춘 뒤 이만큼 기다렸다 부른다(ms, 기본 250) */
  debounceMs?: number
  /** 이 글자 수 미만이면 찾지 않는다(기본 0) */
  minChars?: number
  placeholder?: string
  disabled?: boolean
  name?: string
  /** 후보 목록의 낭독 이름(기본 `Suggestions`) */
  listLabel?: string
  loadingLabel?: string
  emptyLabel?: string
  errorLabel?: string
  /** 후보가 나왔을 때 낭독 · 표시 글(기본 `3 results`) */
  resultsLabel?: (count: number) => string
}

type Status = 'idle' | 'loading' | 'error'

/**
 * 자동완성 입력 — WAI-ARIA combobox(편집 가능 · 목록 팝업 · `aria-activedescendant`). ↓↑ 로 후보를 옮기고(끝에서 돈다) Enter 로 고르며,
 * Esc 는 열린 목록을 닫고 한 번 더 누르면 입력을 비운다. 후보에 없는 글은 값이 아니다 — 포커스가 나가면 고른 라벨로 되돌아간다.
 * `Field` 안에서 `Input` 처럼 쓴다. 후보 수 · 불러오는 중 · 없음 · 오류는 `role="status"` 로 낭독된다.
 */
export function Combobox({
  id,
  'aria-describedby': describedBy,
  invalid,
  selected,
  onSelect,
  options,
  loadOptions,
  debounceMs = 250,
  minChars = 0,
  placeholder,
  disabled,
  name,
  listLabel = 'Suggestions',
  loadingLabel = 'Loading',
  emptyLabel = 'No results',
  errorLabel = 'Could not load options',
  resultsLabel = (count) => `${count} results`,
}: ComboboxProps) {
  const generated = useId()
  const inputId = id ?? `${generated}-input`
  const listId = `${generated}-list`
  const optionId = (index: number) => `${generated}-option-${index}`

  const [text, setText] = useState(selected?.label ?? '')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [results, setResults] = useState<ComboboxOption[]>([])
  const [status, setStatus] = useState<Status>('idle')
  const guard = useRef(createRequestGuard())
  const abort = useRef<AbortController | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // 부모가 고른 것을 바꾸면(초기화 · 다른 곳에서 선택) 입력칸이 따라간다
  const selectedLabel = selected?.label ?? ''
  const [syncedLabel, setSyncedLabel] = useState(selectedLabel)
  if (syncedLabel !== selectedLabel) {
    setSyncedLabel(selectedLabel)
    setText(selectedLabel)
  }

  useEffect(
    () => () => {
      clearTimeout(timer.current)
      abort.current?.abort()
    },
    [],
  )

  function search(query: string, immediate: boolean) {
    clearTimeout(timer.current)
    abort.current?.abort()
    guard.current.cancel()
    if (query.trim().length < minChars) {
      setResults([])
      setStatus('idle')
      return
    }
    if (!loadOptions) {
      setResults(filterOptions(options ?? [], query))
      setStatus('idle')
      return
    }
    setStatus('loading')
    const run = () => {
      const id = guard.current.next()
      const controller = new AbortController()
      abort.current = controller
      loadOptions(query, controller.signal)
        .then((found) => {
          if (!guard.current.isCurrent(id)) return
          setResults(found)
          setStatus('idle')
        })
        .catch(() => {
          if (!guard.current.isCurrent(id)) return
          setResults([])
          setStatus('error')
        })
    }
    if (immediate || debounceMs <= 0) run()
    else timer.current = setTimeout(run, debounceMs)
  }

  function openList(query: string, immediate: boolean) {
    setOpen(true)
    setActive(-1)
    search(query, immediate)
  }

  function close(restore: boolean) {
    clearTimeout(timer.current)
    abort.current?.abort()
    guard.current.cancel()
    setOpen(false)
    setActive(-1)
    setStatus('idle')
    if (restore) setText(selected?.label ?? '')
  }

  function choose(option: ComboboxOption) {
    if (option.disabled) return
    setText(option.label)
    setSyncedLabel(option.label)
    onSelect(option)
    close(false)
  }

  // 후보가 있을 때만 「펼쳐짐」 — 없음 · 불러오는 중 · 오류는 목록이 없으니 아래 status 글로 알린다(펼쳐졌다면 aria-controls 가 가리킬 목록이 있어야 한다)
  const showList = open && results.length > 0
  const disabledIndexes = new Set(
    results.flatMap((option, index) => (option.disabled ? [index] : [])),
  )

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    const { key } = event
    if (key === 'ArrowDown' || key === 'ArrowUp') {
      event.preventDefault()
      if (!open) {
        openList(text, true)
        return
      }
      setActive((current) => nextActiveIndex(current, results.length, key, disabledIndexes))
    } else if ((key === 'Home' || key === 'End') && open && active >= 0) {
      // 입력칸의 커서 이동을 가로채지 않는다 — 활성 항목이 있을 때만 목록 처음 · 끝으로
      event.preventDefault()
      setActive(nextActiveIndex(active, results.length, key, disabledIndexes))
    } else if (key === 'Enter') {
      if (open && active >= 0 && results[active]) {
        event.preventDefault()
        choose(results[active])
      }
    } else if (key === 'Escape') {
      if (open) {
        event.preventDefault()
        event.stopPropagation()
        close(true)
      } else if (text) {
        event.preventDefault()
        setText('')
        onSelect(null)
      }
    } else if (key === 'Tab') {
      close(true)
    }
  }

  const message =
    !open || text.trim().length < minChars
      ? ''
      : status === 'loading'
        ? loadingLabel
        : status === 'error'
          ? errorLabel
          : results.length === 0
            ? emptyLabel
            : resultsLabel(results.length)

  return (
    <div className={styles.root}>
      <Input
        id={inputId}
        name={name}
        role="combobox"
        aria-expanded={showList}
        aria-controls={showList ? listId : undefined}
        aria-autocomplete="list"
        aria-haspopup="listbox"
        aria-activedescendant={showList && active >= 0 ? optionId(active) : undefined}
        aria-describedby={describedBy}
        invalid={invalid}
        autoComplete="off"
        placeholder={placeholder}
        disabled={disabled}
        value={text}
        onChange={(event) => {
          setText(event.target.value)
          openList(event.target.value, false)
        }}
        onClick={() => {
          if (!open && !disabled) openList(text, true)
        }}
        onKeyDown={onKeyDown}
        onBlur={() => close(true)}
      />
      {open && (
        <div className={styles.popup}>
          {showList && (
            <ul id={listId} role="listbox" aria-label={listLabel} className={styles.list}>
              {results.map((option, index) => (
                <li
                  key={option.value}
                  id={optionId(index)}
                  role="option"
                  aria-selected={selected?.value === option.value}
                  aria-disabled={option.disabled || undefined}
                  className={styles.option}
                  data-active={index === active ? 'true' : undefined}
                  // 입력칸이 포커스를 잃지 않게(블러가 먼저 목록을 닫아 클릭이 사라지는 일을 막는다)
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseMove={() => !option.disabled && setActive(index)}
                  onClick={() => choose(option)}
                >
                  <span>{option.label}</span>
                  {option.description && (
                    <span className={styles.description}>{option.description}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <div role="status" className={open && !showList && message ? styles.message : styles.srOnly}>
        {message}
      </div>
    </div>
  )
}
