// 아주 작은 JSON Schema 검사기 — docs/capabilities.schema.json 이 쓰는 부분집합만(type · enum · const · pattern · minLength ·
// minItems · uniqueItems · items · properties · required · additionalProperties:false · oneOf · $ref). 의존을 늘리지 않으려고 직접 짠다.
const typeOf = (value) =>
  value === null
    ? 'null'
    : Array.isArray(value)
      ? 'array'
      : typeof value === 'object'
        ? 'object'
        : typeof value
const show = (value) => JSON.stringify(value)

export function validate(value, schema, root, path = '$') {
  if (schema.$ref) return validate(value, resolve(root, schema.$ref), root, path)
  const problems = []
  if (schema.oneOf) {
    const matches = schema.oneOf.filter(
      (option) => validate(value, option, root, path).length === 0,
    )
    if (matches.length !== 1) {
      // 가장 가까운 후보(null 이 아닌 쪽)의 문제를 보여 준다
      const detail = schema.oneOf.flatMap((option) =>
        option.type === 'null' ? [] : validate(value, option, root, path),
      )
      return detail.length ? detail : [`${path}: does not match exactly one of the allowed shapes`]
    }
    return []
  }
  if (schema.const !== undefined && value !== schema.const)
    problems.push(`${path} must be ${show(schema.const)} (got ${show(value)})`)
  if (schema.enum && !schema.enum.includes(value))
    problems.push(`${path} must be one of: ${schema.enum.join(', ')} (got ${show(value)})`)
  if (schema.type) {
    const allowed = [].concat(schema.type)
    const actual = typeOf(value)
    if (
      !allowed.includes(actual) &&
      !(actual === 'number' && allowed.includes('integer') && Number.isInteger(value))
    )
      return [...problems, `${path} must be ${allowed.join(' or ')} (got ${actual})`]
  }
  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength)
      problems.push(`${path} must not be empty`)
    if (schema.pattern && !new RegExp(schema.pattern).test(value))
      problems.push(`${path} must match ${schema.pattern} (got ${show(value)})`)
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems)
      problems.push(`${path} needs at least ${schema.minItems} item(s)`)
    if (schema.uniqueItems && new Set(value.map(show)).size !== value.length)
      problems.push(`${path} has duplicates`)
    if (schema.items)
      value.forEach((item, i) =>
        problems.push(...validate(item, schema.items, root, `${path}[${i}]`)),
      )
  }
  if (typeOf(value) === 'object') {
    const known = Object.keys(schema.properties ?? {})
    for (const key of schema.required ?? [])
      if (!(key in value)) problems.push(`${path}.${key} is required`)
    for (const key of Object.keys(value)) {
      if (schema.properties?.[key])
        problems.push(...validate(value[key], schema.properties[key], root, `${path}.${key}`))
      else if (schema.additionalProperties === false)
        problems.push(`${path}.${key} is not allowed (known fields: ${known.join(', ')})`)
    }
  }
  return problems
}

function resolve(root, ref) {
  const target = ref
    .replace(/^#\//, '')
    .split('/')
    .reduce((node, key) => node?.[key], root)
  if (!target) throw new Error(`unresolvable $ref ${ref}`)
  return target
}
