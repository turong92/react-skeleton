import { Button, Checkbox, Field, Input, Select, Switch, Textarea } from '@skeleton/ui'
import { Case } from '../../components/Section'
import type { UiEntry } from '../types'

const VARIANTS = ['primary', 'secondary', 'ghost', 'danger'] as const
const SIZES = ['sm', 'md', 'lg'] as const

export const formEntries: UiEntry[] = [
  {
    name: 'Button',
    title: '버튼 — 변형 · 크기 · 비활성 · 로딩',
    render: () => (
      <>
        {VARIANTS.map((variant) => (
          <Case key={variant} label={`variant="${variant}"`}>
            {SIZES.map((size) => (
              <Button key={size} variant={variant} size={size}>
                {size}
              </Button>
            ))}
            <Button variant={variant} disabled>
              disabled
            </Button>
            <Button variant={variant} loading loadingLabel="저장 중">
              loading
            </Button>
          </Case>
        ))}
      </>
    ),
  },
  {
    name: 'Input',
    title: '입력칸 — 기본 · 오류 · 비활성',
    render: () => (
      <>
        <Case label="default">
          <Input aria-label="기본" placeholder="이름" />
        </Case>
        <Case label="invalid">
          <Input aria-label="오류" invalid defaultValue="잘못된 값" />
        </Case>
        <Case label="disabled">
          <Input aria-label="비활성" disabled defaultValue="수정 불가" />
        </Case>
      </>
    ),
  },
  {
    name: 'Field',
    title: '필드 — 라벨 · 도움말 · 오류 · 필수',
    render: () => (
      <>
        <Case label="hint">
          <Field label="이메일" hint="로그인에 쓰는 주소">
            {(control) => <Input {...control} type="email" />}
          </Field>
        </Case>
        <Case label="error + required">
          <Field label="비밀번호" required requiredMark="(필수)" error="8자 이상이어야 합니다">
            {(control) => <Input {...control} type="password" />}
          </Field>
        </Case>
      </>
    ),
  },
  {
    name: 'Select',
    title: '선택 — 기본 · 오류 · 비활성',
    render: () => (
      <>
        {(['default', 'invalid', 'disabled'] as const).map((state) => (
          <Case key={state} label={state}>
            <Select
              aria-label={state}
              invalid={state === 'invalid'}
              disabled={state === 'disabled'}
              defaultValue="b"
            >
              <option value="a">첫째</option>
              <option value="b">둘째</option>
            </Select>
          </Case>
        ))}
      </>
    ),
  },
  {
    name: 'Textarea',
    title: '여러 줄 입력 — 기본 · 오류 · 비활성',
    render: () => (
      <>
        <Case label="default">
          <Textarea aria-label="기본" placeholder="내용" />
        </Case>
        <Case label="invalid">
          <Textarea aria-label="오류" invalid defaultValue="너무 짧음" />
        </Case>
        <Case label="disabled">
          <Textarea aria-label="비활성" disabled defaultValue="수정 불가" />
        </Case>
      </>
    ),
  },
  {
    name: 'Checkbox',
    title: '체크박스 — 선택 · 일부 선택 · 설명 · 오류 · 비활성',
    render: () => (
      <>
        <Case label="default / checked">
          <Checkbox label="약관에 동의" />
          <Checkbox label="선택됨" defaultChecked />
        </Case>
        <Case label="indeterminate">
          <Checkbox label="전체 선택" indeterminate />
        </Case>
        <Case label="description + error">
          <Checkbox label="알림 받기" description="중요한 소식만 보냅니다" error="선택해 주세요" />
        </Case>
        <Case label="disabled">
          <Checkbox label="비활성" disabled />
        </Case>
      </>
    ),
  },
  {
    name: 'Switch',
    title: '스위치 — 꺼짐 · 켜짐 · 비활성',
    render: () => (
      <>
        <Switch label="꺼짐" />
        <Switch label="켜짐" defaultChecked description="설명 한 줄" />
        <Switch label="비활성" disabled />
      </>
    ),
  },
]
