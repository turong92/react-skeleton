import { ThemeToggle, THEMES, setTheme, useTheme } from '@skeleton/theme'
import { Button } from '@skeleton/ui'
import { Case, Row } from '../components/Section'

/** 고른 테마는 localStorage 에 저장되고 `<html data-theme>` 에 달린다 — 이 화면 전체가 바뀐다 */
export function ThemeDemo() {
  const theme = useTheme()
  return (
    <>
      <Case label="<ThemeToggle /> (system → light → dark)">
        <ThemeToggle />
      </Case>
      <Case label={`useTheme() = ${theme}`}>
        <Row>
          {THEMES.map((name) => (
            <Button
              key={name}
              size="sm"
              variant={name === theme ? 'primary' : 'secondary'}
              aria-pressed={name === theme}
              onClick={() => setTheme(name)}
            >
              {name}
            </Button>
          ))}
        </Row>
      </Case>
    </>
  )
}
