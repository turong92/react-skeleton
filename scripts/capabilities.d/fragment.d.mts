import type { Catalog } from './lib.mjs'
export function fragmentFor(
  catalog: Catalog,
  ids: string[],
  extraFlags?: string[],
  kotlinExtraFlags?: string[],
): {
  react: string
  kotlin: string
  packages: string[]
  flags: string[]
  defaults: string[]
  modules: string[]
  choices: string[][]
}
