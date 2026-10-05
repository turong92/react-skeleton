// 항목 id 들 → new-project.sh 에 적을 명령 조각. 손으로 적지 않고 카탈로그의 stampFlag · backend 에서 계산한다
// (레시피 · 결정표 · 테스트가 같은 함수를 쓴다).
const byId = (catalog) => new Map(catalog.capabilities.map((entry) => [entry.id, entry]))

/** @returns {{ react: string, kotlin: string, packages: string[], flags: string[], defaults: string[], modules: string[], choices: string[][] }} */
export function fragmentFor(catalog, ids, extraFlags = [], kotlinExtraFlags = []) {
  const entries = byId(catalog)
  const packages = []
  const flags = []
  const defaults = []
  const modules = []
  const choices = []
  const starter = new Set(catalog.newProject?.kotlin?.starterModules ?? [])
  const add = (list, item) => list.includes(item) || list.push(item)
  // 패턴은 다른 항목 위에 얹힌 한 기능이라 needs 도 함께 켠다(패키지의 needs 는 new-project.sh 가 의존으로 닫아 준다)
  const expanded = []
  const expand = (id) => {
    const entry = entries.get(id)
    if (!entry) throw new Error(`unknown capability id: ${id}`)
    if (expanded.includes(id)) return
    if (entry.kind === 'pattern') entry.needs.forEach(expand)
    expanded.push(id)
  }
  ids.forEach(expand)
  for (const id of expanded) {
    const entry = entries.get(id)
    const { flag, included } = entry.stampFlag
    if (included === 'flag' && flag) {
      const m = flag.match(/^--packages (\S+)$/)
      if (m) m[1].split(',').forEach((p) => add(packages, p))
      else add(flags, flag)
    } else defaults.push(id)
    if (entry.backend) {
      entry.backend.modules.filter((m) => !starter.has(m)).forEach((m) => add(modules, m))
      for (const group of entry.backend.oneOfModules ?? []) {
        add(modules, group[0])
        if (!choices.some((g) => g.join() === group.join())) choices.push(group)
      }
    }
  }
  extraFlags.forEach((f) => add(flags, f))
  const react = [...(packages.length ? [`--packages ${packages.join(',')}`] : []), ...flags].join(
    ' ',
  )
  const kotlin = [
    ...(modules.length ? [`--modules ${modules.join(',')}`] : []),
    ...kotlinExtraFlags,
  ].join(' ')
  return { react, kotlin, packages, flags, defaults, modules, choices }
}
