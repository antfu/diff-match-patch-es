import type { DiffMatchPathOptions, ResolvedOptions } from './types'

export const defaultOptions: ResolvedOptions = /* #__PURE__ */ Object.freeze({
  diffTimeout: 1,
  diffEditCost: 4,
  matchThreshold: 0.5,
  matchDistance: 1000,
  patchDeleteThreshold: 0.5,
  patchMargin: 4,
  matchMaxBits: 32,
})

export function resolveOptions(options?: DiffMatchPathOptions): ResolvedOptions {
  // @ts-expect-error __resolved is a non-enumerable property
  if (options?.__resolved)
    return options as ResolvedOptions

  const resolved = {
    ...defaultOptions,
    ...options,
  }
  Object.defineProperty(resolved, '__resolved', { value: true, enumerable: false })
  return resolved
}
