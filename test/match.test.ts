import { expect, it } from 'vitest'

import {
  matchAlphabet,
  matchBitap,
  matchMain,
} from '../src/match'
import {
  resolveOptions,
} from '../src/options'

it('matchAlphabet', () => {
  // Initialise the bitmasks for Bitap.
  // Unique.
  expect(matchAlphabet('abc')).toEqual({ a: 4, b: 2, c: 1 })

  // Duplicates.
  expect(matchAlphabet('abcaba')).toEqual({ a: 37, b: 18, c: 8 })
})

it('matchBitap', () => {
  const options = resolveOptions({
    matchDistance: 100,
    matchMaxBits: 32,
  })

  // Bitap algorithm.
  // Exact matches.
  expect(matchBitap('abcdefghijk', 'fgh', 5, options)).toBe(5)

  expect(matchBitap('abcdefghijk', 'fgh', 0, options)).toBe(5)

  // Fuzzy matches.
  expect(matchBitap('abcdefghijk', 'efxhi', 0, options)).toBe(4)

  expect(matchBitap('abcdefghijk', 'cdefxyhijk', 5, options)).toBe(2)

  expect(matchBitap('abcdefghijk', 'bxy', 1, options)).toBe(-1)

  // Overflow.
  expect(matchBitap('123456789xx0', '3456789x0', 2, options)).toBe(2)

  // Threshold test.
  options.matchThreshold = 0.4
  expect(matchBitap('abcdefghijk', 'efxyhi', 1, options)).toBe(4)

  options.matchThreshold = 0.3
  expect(matchBitap('abcdefghijk', 'efxyhi', 1, options)).toBe(-1)

  options.matchThreshold = 0.0
  expect(matchBitap('abcdefghijk', 'bcdef', 1, options)).toBe(1)

  options.matchThreshold = 0.5

  // Multiple select.
  expect(matchBitap('abcdexyzabcde', 'abccde', 3, options)).toBe(0)

  expect(matchBitap('abcdexyzabcde', 'abccde', 5, options)).toBe(8)

  // Distance test.
  options.matchDistance = 10 // Strict location.
  expect(matchBitap('abcdefghijklmnopqrstuvwxyz', 'abcdefg', 24, options)).toBe(-1)

  expect(matchBitap('abcdefghijklmnopqrstuvwxyz', 'abcdxxefg', 1, options)).toBe(0)

  options.matchDistance = 1000 // Loose location.
  expect(matchBitap('abcdefghijklmnopqrstuvwxyz', 'abcdefg', 24, options)).toBe(0)
})

it('matchMain', () => {
  const options = resolveOptions({})

  // Full match.
  // Shortcut matches.
  expect(matchMain('abcdef', 'abcdef', 1000, options)).toBe(0)

  expect(matchMain('', 'abcdef', 1, options)).toBe(-1)

  expect(matchMain('abcdef', '', 3, options)).toBe(3)

  expect(matchMain('abcdef', 'de', 3, options)).toBe(3)

  // Beyond end match.
  expect(matchMain('abcdef', 'defy', 4, options)).toBe(3)

  // Oversized pattern.
  expect(matchMain('abcdef', 'abcdefy', 0, options)).toBe(0)

  // Complex match.
  expect(matchMain('I am the very model of a modern major general.', ' that berry ', 5, options)).toBe(4)

  // Test null inputs.
  expect(() => matchMain(null as any, null as any, 0, options))
    .toThrowErrorMatchingInlineSnapshot(`[Error: Null input. (match_main)]`)
})
