import { expect, it } from 'vitest'
import {
  DIFF_DELETE,
  DIFF_EQUAL,
  DIFF_INSERT,
  diffBisect,
  diffCharsToLines,
  diffCleanupEfficiency,
  diffCleanupMerge,
  diffCleanupSemantic,
  diffCleanupSemanticLossless,
  diffCommonOverlap,
  diffCommonPrefix,
  diffCommonSuffix,
  diffFromDelta,
  diffHalfMatch,
  diffLevenshtein,
  diffLinesToChars,
  diffMain,
  diffPrettyHtml,
  diffText1,
  diffText2,
  diffToDelta,
  diffXIndex,
} from '../src/diff'
import {
  resolveOptions,
} from '../src/options'
import type { Diff } from '../src/types'

/**
 * Diff Match and Patch -- Test Harness
 * Copyright 2018 The diff-match-patch Authors.
 * https://github.com/google/diff-match-patch
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

function diffRebuildTexts(diffs: Diff[]) {
  // Construct the two texts which made up the diff originally.
  let text1 = ''
  let text2 = ''
  for (let x = 0; x < diffs.length; x++) {
    if (diffs[x][0] !== DIFF_INSERT)
      text1 += diffs[x][1]
    if (diffs[x][0] !== DIFF_DELETE)
      text2 += diffs[x][1]
  }
  return [text1, text2]
}

it('diffCommonPrefix', () => {
  // Detect any common prefix.
  // Null case.
  expect(diffCommonPrefix('abc', 'xyz')).toBe(0)

  // Non-null case.
  expect(diffCommonPrefix('1234', '1234xyz')).toBe(4)

  // Whole case.
  expect(diffCommonPrefix('1234', 'xyz1234')).toBe(0)
})

it('diffCommonSuffix', () => {
  // Detect any common suffix.
  // Null case.
  expect(diffCommonSuffix('abc', 'xyz')).toBe(0)

  // Non-null case.
  expect(diffCommonSuffix('abcdef1234', 'xyz1234')).toBe(4)

  // Whole case.
  expect(diffCommonSuffix('1234', 'xyz1234')).toBe(4)
})

it('diffCommonOverlap', () => {
  // Detect any suffix/prefix overlap.
  // Null case.
  expect(diffCommonOverlap('', 'abcd')).toBe(0)

  // Whole case.
  expect(diffCommonOverlap('abc', 'abcd')).toBe(3)

  // No overlap.
  expect(diffCommonOverlap('123456', 'abcd')).toBe(0)

  // Overlap.
  expect(diffCommonOverlap('123456xxx', 'xxxabcd')).toBe(3)

  // Unicode.
  // Some overly clever languages (C#) may treat ligatures as equal to their
  // component letters.  E.g. U+FB01 == 'fi'
  expect(diffCommonOverlap('fi', '\uFB01i')).toBe(0)
})

it('diffHalfMatch', () => {
  const options = resolveOptions({
    // Detect a halfmatch.
    diffTimeout: 1,
  })

  // No match.
  expect(diffHalfMatch('1234567890', 'abcdef', options)).toBe(null)

  expect(diffHalfMatch('12345', '23', options)).toBe(null)

  // Single Match.
  expect(diffHalfMatch('1234567890', 'a345678z', options)).toEqual(['12', '90', 'a', 'z', '345678'])

  expect(diffHalfMatch('a345678z', '1234567890', options)).toEqual(['a', 'z', '12', '90', '345678'])

  expect(diffHalfMatch('abc56789z', '1234567890', options)).toEqual(['abc', 'z', '1234', '0', '56789'])

  expect(diffHalfMatch('a23456xyz', '1234567890', options)).toEqual(['a', 'xyz', '1', '7890', '23456'])

  // Multiple Matches.
  expect(diffHalfMatch('121231234123451234123121', 'a1234123451234z', options)).toEqual(['12123', '123121', 'a', 'z', '1234123451234'])

  expect(diffHalfMatch('x-=-=-=-=-=-=-=-=-=-=-=-=', 'xx-=-=-=-=-=-=-=', options)).toEqual(['', '-=-=-=-=-=', 'x', '', 'x-=-=-=-=-=-=-='])

  expect(diffHalfMatch('-=-=-=-=-=-=-=-=-=-=-=-=y', '-=-=-=-=-=-=-=yy', options)).toEqual(['-=-=-=-=-=', '', '', 'y', '-=-=-=-=-=-=-=y'])

  // Non-optimal halfmatch.
  // Optimal diff would be -q+x=H-i+e=lloHe+Hu=llo-Hew+y not -qHillo+x=HelloHe-w+Hulloy
  expect(diffHalfMatch('qHilloHelloHew', 'xHelloHeHulloy', options)).toEqual(['qHillo', 'w', 'x', 'Hulloy', 'HelloHe'])

  // Optimal no halfmatch.
  options.diffTimeout = 0
  expect(diffHalfMatch('qHilloHelloHew', 'xHelloHeHulloy', options)).toBe(null)
})

it('diffLinesToChars', () => {
  function assert(a: ReturnType<typeof diffLinesToChars>, b: ReturnType<typeof diffLinesToChars>) {
    expect(a.chars1).toEqual(b.chars1)
    expect(a.chars2).toEqual(b.chars2)
    expect(a.lineArray).toEqual(b.lineArray)
  }

  // Convert lines down to characters.
  assert(
    { chars1: '\x01\x02\x01', chars2: '\x02\x01\x02', lineArray: ['', 'alpha\n', 'beta\n'] },
    diffLinesToChars('alpha\nbeta\nalpha\n', 'beta\nalpha\nbeta\n'),
  )

  assert(
    { chars1: '', chars2: '\x01\x02\x03\x03', lineArray: ['', 'alpha\r\n', 'beta\r\n', '\r\n'] },
    diffLinesToChars('', 'alpha\r\nbeta\r\n\r\n\r\n'),
  )

  assert(
    { chars1: '\x01', chars2: '\x02', lineArray: ['', 'a', 'b'] },
    diffLinesToChars('a', 'b'),
  )

  // More than 256 to reveal any 8-bit limitations.
  const n = 300
  const lineList = []
  const charList = []
  for (let i = 1; i < n + 1; i++) {
    lineList[i - 1] = `${i}\n`
    charList[i - 1] = String.fromCharCode(i)
  }
  expect(lineList.length).toBe(n)
  const lines = lineList.join('')
  const chars = charList.join('')
  expect(chars.length).toBe(n)
  lineList.unshift('')
  assert(
    { chars1: chars, chars2: '', lineArray: lineList },
    diffLinesToChars(lines, ''),
  )
})

it('diffCharsToLines', () => {
  // Convert chars up to lines.
  let diffs: Diff[] = [
    [DIFF_EQUAL, '\x01\x02\x01'],
    [DIFF_INSERT, '\x02\x01\x02'],
  ]
  diffCharsToLines(diffs, ['', 'alpha\n', 'beta\n'])
  expect(diffs).toEqual([
    [DIFF_EQUAL, 'alpha\nbeta\nalpha\n'],
    [DIFF_INSERT, 'beta\nalpha\nbeta\n'],
  ])

  // More than 256 to reveal any 8-bit limitations.
  const n = 300
  let lineList = []
  const charList = []
  for (let i = 1; i < n + 1; i++) {
    lineList[i - 1] = `${i}\n`
    charList[i - 1] = String.fromCharCode(i)
  }
  expect(lineList.length).toBe(n)
  const lines = lineList.join('')
  let chars = charList.join('')
  expect(chars.length).toBe(n)
  lineList.unshift('')

  diffs = [[DIFF_DELETE, chars]]
  diffCharsToLines(diffs, lineList)
  expect(diffs).toEqual([[DIFF_DELETE, lines]])

  // More than 65536 to verify any 16-bit limitation.
  lineList = []
  for (let i = 0; i < 66000; i++)
    lineList[i] = `${i}\n`

  chars = lineList.join('')
  const results = diffLinesToChars(chars, '')
  diffs = [[DIFF_INSERT, results.chars1]]
  diffCharsToLines(diffs, results.lineArray)
  expect(diffs[0][1]).toEqual(chars)
})

it('diffCleanupMerge', () => {
  // Cleanup a messy diff.
  // Null case.
  let diffs: Diff[] = []
  diffCleanupMerge(diffs)
  expect(diffs).toEqual([])

  // No change case.
  diffs = [[DIFF_EQUAL, 'a'], [DIFF_DELETE, 'b'], [DIFF_INSERT, 'c']]
  diffCleanupMerge(diffs)
  expect(diffs).toEqual([[DIFF_EQUAL, 'a'], [DIFF_DELETE, 'b'], [DIFF_INSERT, 'c']])

  // Merge equalities.
  diffs = [[DIFF_EQUAL, 'a'], [DIFF_EQUAL, 'b'], [DIFF_EQUAL, 'c']]
  diffCleanupMerge(diffs)
  expect(diffs).toEqual([[DIFF_EQUAL, 'abc']])

  // Merge deletions.
  diffs = [[DIFF_DELETE, 'a'], [DIFF_DELETE, 'b'], [DIFF_DELETE, 'c']]
  diffCleanupMerge(diffs)
  expect(diffs).toEqual([[DIFF_DELETE, 'abc']])

  // Merge insertions.
  diffs = [[DIFF_INSERT, 'a'], [DIFF_INSERT, 'b'], [DIFF_INSERT, 'c']]
  diffCleanupMerge(diffs)
  expect(diffs).toEqual([[DIFF_INSERT, 'abc']])

  // Merge interweave.
  diffs = [[DIFF_DELETE, 'a'], [DIFF_INSERT, 'b'], [DIFF_DELETE, 'c'], [DIFF_INSERT, 'd'], [DIFF_EQUAL, 'e'], [DIFF_EQUAL, 'f']]
  diffCleanupMerge(diffs)
  expect(diffs).toEqual([[DIFF_DELETE, 'ac'], [DIFF_INSERT, 'bd'], [DIFF_EQUAL, 'ef']])

  // Prefix and suffix detection.
  diffs = [[DIFF_DELETE, 'a'], [DIFF_INSERT, 'abc'], [DIFF_DELETE, 'dc']]
  diffCleanupMerge(diffs)
  expect(diffs).toEqual([[DIFF_EQUAL, 'a'], [DIFF_DELETE, 'd'], [DIFF_INSERT, 'b'], [DIFF_EQUAL, 'c']])

  // Prefix and suffix detection with equalities.
  diffs = [[DIFF_EQUAL, 'x'], [DIFF_DELETE, 'a'], [DIFF_INSERT, 'abc'], [DIFF_DELETE, 'dc'], [DIFF_EQUAL, 'y']]
  diffCleanupMerge(diffs)
  expect(diffs).toEqual([[DIFF_EQUAL, 'xa'], [DIFF_DELETE, 'd'], [DIFF_INSERT, 'b'], [DIFF_EQUAL, 'cy']])

  // Slide edit left.
  diffs = [[DIFF_EQUAL, 'a'], [DIFF_INSERT, 'ba'], [DIFF_EQUAL, 'c']]
  diffCleanupMerge(diffs)
  expect(diffs).toEqual([[DIFF_INSERT, 'ab'], [DIFF_EQUAL, 'ac']])

  // Slide edit right.
  diffs = [[DIFF_EQUAL, 'c'], [DIFF_INSERT, 'ab'], [DIFF_EQUAL, 'a']]
  diffCleanupMerge(diffs)
  expect(diffs).toEqual([[DIFF_EQUAL, 'ca'], [DIFF_INSERT, 'ba']])

  // Slide edit left recursive.
  diffs = [[DIFF_EQUAL, 'a'], [DIFF_DELETE, 'b'], [DIFF_EQUAL, 'c'], [DIFF_DELETE, 'ac'], [DIFF_EQUAL, 'x']]
  diffCleanupMerge(diffs)
  expect(diffs).toEqual([[DIFF_DELETE, 'abc'], [DIFF_EQUAL, 'acx']])

  // Slide edit right recursive.
  diffs = [[DIFF_EQUAL, 'x'], [DIFF_DELETE, 'ca'], [DIFF_EQUAL, 'c'], [DIFF_DELETE, 'b'], [DIFF_EQUAL, 'a']]
  diffCleanupMerge(diffs)
  expect(diffs).toEqual([[DIFF_EQUAL, 'xca'], [DIFF_DELETE, 'cba']])

  // Empty merge.
  diffs = [[DIFF_DELETE, 'b'], [DIFF_INSERT, 'ab'], [DIFF_EQUAL, 'c']]
  diffCleanupMerge(diffs)
  expect(diffs).toEqual([[DIFF_INSERT, 'a'], [DIFF_EQUAL, 'bc']])

  // Empty equality.
  diffs = [[DIFF_EQUAL, ''], [DIFF_INSERT, 'a'], [DIFF_EQUAL, 'b']]
  diffCleanupMerge(diffs)
  expect(diffs).toEqual([[DIFF_INSERT, 'a'], [DIFF_EQUAL, 'b']])
})

it('diffCleanupSemanticLossless', () => {
  let diffs: Diff[] = []

  // Cleanup semantically trivial equalities.
  // Null case.
  diffs = []
  diffCleanupSemanticLossless(diffs)
  expect(diffs).toEqual([])

  // Blank lines.
  diffs = [[DIFF_EQUAL, 'AAA\r\n\r\nBBB'], [DIFF_INSERT, '\r\nDDD\r\n\r\nBBB'], [DIFF_EQUAL, '\r\nEEE']]
  diffCleanupSemanticLossless(diffs)
  expect(diffs).toEqual([[DIFF_EQUAL, 'AAA\r\n\r\n'], [DIFF_INSERT, 'BBB\r\nDDD\r\n\r\n'], [DIFF_EQUAL, 'BBB\r\nEEE']])

  // Line boundaries.
  diffs = [[DIFF_EQUAL, 'AAA\r\nBBB'], [DIFF_INSERT, ' DDD\r\nBBB'], [DIFF_EQUAL, ' EEE']]
  diffCleanupSemanticLossless(diffs)
  expect(diffs).toEqual([[DIFF_EQUAL, 'AAA\r\n'], [DIFF_INSERT, 'BBB DDD\r\n'], [DIFF_EQUAL, 'BBB EEE']])

  // Word boundaries.
  diffs = [[DIFF_EQUAL, 'The c'], [DIFF_INSERT, 'ow and the c'], [DIFF_EQUAL, 'at.']]
  diffCleanupSemanticLossless(diffs)
  expect(diffs).toEqual([[DIFF_EQUAL, 'The '], [DIFF_INSERT, 'cow and the '], [DIFF_EQUAL, 'cat.']])

  // Alphanumeric boundaries.
  diffs = [[DIFF_EQUAL, 'The-c'], [DIFF_INSERT, 'ow-and-the-c'], [DIFF_EQUAL, 'at.']]
  diffCleanupSemanticLossless(diffs)
  expect(diffs).toEqual([[DIFF_EQUAL, 'The-'], [DIFF_INSERT, 'cow-and-the-'], [DIFF_EQUAL, 'cat.']])

  // Hitting the start.
  diffs = [[DIFF_EQUAL, 'a'], [DIFF_DELETE, 'a'], [DIFF_EQUAL, 'ax']]
  diffCleanupSemanticLossless(diffs)
  expect(diffs).toEqual([[DIFF_DELETE, 'a'], [DIFF_EQUAL, 'aax']])

  // Hitting the end.
  diffs = [[DIFF_EQUAL, 'xa'], [DIFF_DELETE, 'a'], [DIFF_EQUAL, 'a']]
  diffCleanupSemanticLossless(diffs)
  expect(diffs).toEqual([[DIFF_EQUAL, 'xaa'], [DIFF_DELETE, 'a']])

  // Sentence boundaries.
  diffs = [[DIFF_EQUAL, 'The xxx. The '], [DIFF_INSERT, 'zzz. The '], [DIFF_EQUAL, 'yyy.']]
  diffCleanupSemanticLossless(diffs)
  expect(diffs).toEqual([[DIFF_EQUAL, 'The xxx.'], [DIFF_INSERT, ' The zzz.'], [DIFF_EQUAL, ' The yyy.']])
})

it('diffCleanupSemantic', () => {
  // Cleanup semantically trivial equalities.
  // Null case.
  let diffs: Diff[] = []
  diffCleanupSemantic(diffs)
  expect(diffs).toEqual([])

  // No elimination #1.
  diffs = [[DIFF_DELETE, 'ab'], [DIFF_INSERT, 'cd'], [DIFF_EQUAL, '12'], [DIFF_DELETE, 'e']]
  diffCleanupSemantic(diffs)
  expect(diffs).toEqual([[DIFF_DELETE, 'ab'], [DIFF_INSERT, 'cd'], [DIFF_EQUAL, '12'], [DIFF_DELETE, 'e']])

  // No elimination #2.
  diffs = [[DIFF_DELETE, 'abc'], [DIFF_INSERT, 'ABC'], [DIFF_EQUAL, '1234'], [DIFF_DELETE, 'wxyz']]
  diffCleanupSemantic(diffs)
  expect(diffs).toEqual([[DIFF_DELETE, 'abc'], [DIFF_INSERT, 'ABC'], [DIFF_EQUAL, '1234'], [DIFF_DELETE, 'wxyz']])

  // Simple elimination.
  diffs = [[DIFF_DELETE, 'a'], [DIFF_EQUAL, 'b'], [DIFF_DELETE, 'c']]
  diffCleanupSemantic(diffs)
  expect(diffs).toEqual([[DIFF_DELETE, 'abc'], [DIFF_INSERT, 'b']])

  // Backpass elimination.
  diffs = [[DIFF_DELETE, 'ab'], [DIFF_EQUAL, 'cd'], [DIFF_DELETE, 'e'], [DIFF_EQUAL, 'f'], [DIFF_INSERT, 'g']]
  diffCleanupSemantic(diffs)
  expect(diffs).toEqual([[DIFF_DELETE, 'abcdef'], [DIFF_INSERT, 'cdfg']])

  // Multiple eliminations.
  diffs = [[DIFF_INSERT, '1'], [DIFF_EQUAL, 'A'], [DIFF_DELETE, 'B'], [DIFF_INSERT, '2'], [DIFF_EQUAL, '_'], [DIFF_INSERT, '1'], [DIFF_EQUAL, 'A'], [DIFF_DELETE, 'B'], [DIFF_INSERT, '2']]
  diffCleanupSemantic(diffs)
  expect(diffs).toEqual([[DIFF_DELETE, 'AB_AB'], [DIFF_INSERT, '1A2_1A2']])

  // Word boundaries.
  diffs = [[DIFF_EQUAL, 'The c'], [DIFF_DELETE, 'ow and the c'], [DIFF_EQUAL, 'at.']]
  diffCleanupSemantic(diffs)
  expect(diffs).toEqual([[DIFF_EQUAL, 'The '], [DIFF_DELETE, 'cow and the '], [DIFF_EQUAL, 'cat.']])

  // No overlap elimination.
  diffs = [[DIFF_DELETE, 'abcxx'], [DIFF_INSERT, 'xxdef']]
  diffCleanupSemantic(diffs)
  expect(diffs).toEqual([[DIFF_DELETE, 'abcxx'], [DIFF_INSERT, 'xxdef']])

  // Overlap elimination.
  diffs = [[DIFF_DELETE, 'abcxxx'], [DIFF_INSERT, 'xxxdef']]
  diffCleanupSemantic(diffs)
  expect(diffs).toEqual([[DIFF_DELETE, 'abc'], [DIFF_EQUAL, 'xxx'], [DIFF_INSERT, 'def']])

  // Reverse overlap elimination.
  diffs = [[DIFF_DELETE, 'xxxabc'], [DIFF_INSERT, 'defxxx']]
  diffCleanupSemantic(diffs)
  expect(diffs).toEqual([[DIFF_INSERT, 'def'], [DIFF_EQUAL, 'xxx'], [DIFF_DELETE, 'abc']])

  // Two overlap eliminations.
  diffs = [[DIFF_DELETE, 'abcd1212'], [DIFF_INSERT, '1212efghi'], [DIFF_EQUAL, '----'], [DIFF_DELETE, 'A3'], [DIFF_INSERT, '3BC']]
  diffCleanupSemantic(diffs)
  expect(diffs).toEqual([[DIFF_DELETE, 'abcd'], [DIFF_EQUAL, '1212'], [DIFF_INSERT, 'efghi'], [DIFF_EQUAL, '----'], [DIFF_DELETE, 'A'], [DIFF_EQUAL, '3'], [DIFF_INSERT, 'BC']])
})

it('diffCleanupEfficiency', () => {
  const options = resolveOptions({
    // Cleanup operationally trivial equalities.
    diffEditCost: 4,
  })

  // Null case.
  let diffs: Diff[] = []
  diffCleanupEfficiency(diffs, options)
  expect(diffs).toEqual([])

  // No elimination.
  diffs = [[DIFF_DELETE, 'ab'], [DIFF_INSERT, '12'], [DIFF_EQUAL, 'wxyz'], [DIFF_DELETE, 'cd'], [DIFF_INSERT, '34']]
  diffCleanupEfficiency(diffs, options)
  expect(diffs).toEqual([[DIFF_DELETE, 'ab'], [DIFF_INSERT, '12'], [DIFF_EQUAL, 'wxyz'], [DIFF_DELETE, 'cd'], [DIFF_INSERT, '34']])

  // Four-edit elimination.
  diffs = [[DIFF_DELETE, 'ab'], [DIFF_INSERT, '12'], [DIFF_EQUAL, 'xyz'], [DIFF_DELETE, 'cd'], [DIFF_INSERT, '34']]
  diffCleanupEfficiency(diffs, options)
  expect(diffs).toEqual([[DIFF_DELETE, 'abxyzcd'], [DIFF_INSERT, '12xyz34']])

  // Three-edit elimination.
  diffs = [[DIFF_INSERT, '12'], [DIFF_EQUAL, 'x'], [DIFF_DELETE, 'cd'], [DIFF_INSERT, '34']]
  diffCleanupEfficiency(diffs, options)
  expect(diffs).toEqual([[DIFF_DELETE, 'xcd'], [DIFF_INSERT, '12x34']])

  // Backpass elimination.
  diffs = [[DIFF_DELETE, 'ab'], [DIFF_INSERT, '12'], [DIFF_EQUAL, 'xy'], [DIFF_INSERT, '34'], [DIFF_EQUAL, 'z'], [DIFF_DELETE, 'cd'], [DIFF_INSERT, '56']]
  diffCleanupEfficiency(diffs, options)
  expect(diffs).toEqual([[DIFF_DELETE, 'abxyzcd'], [DIFF_INSERT, '12xy34z56']])

  // High cost elimination.
  options.diffEditCost = 5
  diffs = [[DIFF_DELETE, 'ab'], [DIFF_INSERT, '12'], [DIFF_EQUAL, 'wxyz'], [DIFF_DELETE, 'cd'], [DIFF_INSERT, '34']]
  diffCleanupEfficiency(diffs, options)
  expect(diffs).toEqual([[DIFF_DELETE, 'abwxyzcd'], [DIFF_INSERT, '12wxyz34']])
})

it('diffPrettyHtml', () => {
  // Pretty print.
  const diffs: Diff[] = [[DIFF_EQUAL, 'a\n'], [DIFF_DELETE, '<B>b</B>'], [DIFF_INSERT, 'c&d']]
  expect(diffPrettyHtml(diffs))
    .toBe('<span>a&para;<br></span><del style="background:#ffe6e6;">&lt;B&gt;b&lt;/B&gt;</del><ins style="background:#e6ffe6;">c&amp;d</ins>')
})

it('diffText', () => {
  // Compute the source and destination texts.
  const diffs: Diff[] = [[DIFF_EQUAL, 'jump'], [DIFF_DELETE, 's'], [DIFF_INSERT, 'ed'], [DIFF_EQUAL, ' over '], [DIFF_DELETE, 'the'], [DIFF_INSERT, 'a'], [DIFF_EQUAL, ' lazy']]
  expect(diffText1(diffs)).toBe('jumps over the lazy')
  expect(diffText2(diffs)).toBe('jumped over a lazy')
})

it('diffDelta', () => {
  // Convert a diff into delta string.
  let diffs: Diff[] = [[DIFF_EQUAL, 'jump'], [DIFF_DELETE, 's'], [DIFF_INSERT, 'ed'], [DIFF_EQUAL, ' over '], [DIFF_DELETE, 'the'], [DIFF_INSERT, 'a'], [DIFF_EQUAL, ' lazy'], [DIFF_INSERT, 'old dog']]
  let text1 = diffText1(diffs)
  expect(text1).toBe('jumps over the lazy')

  let delta = diffToDelta(diffs)
  expect(delta).toBe('=4\t-1\t+ed\t=6\t-3\t+a\t=5\t+old dog')

  // Convert delta string into a diff.
  expect(diffFromDelta(text1, delta)).toEqual(diffs)

  // Generates error (19 != 20).
  expect(() => diffFromDelta(`${text1}x`, delta))
    .toThrowErrorMatchingInlineSnapshot(`[Error: Delta length (19) does not equal source text length (20).]`)

  // Generates error (19 != 18).
  expect(() => diffFromDelta(text1.substring(1), delta))
    .toThrowErrorMatchingInlineSnapshot(`[Error: Delta length (19) does not equal source text length (18).]`)

  // Generates error (%c3%xy invalid Unicode).
  expect(() => diffFromDelta('', '+%c3%xy'))
    .toThrowErrorMatchingInlineSnapshot(`[Error: Illegal escape in diff_fromDelta: %c3%xy]`)

  // Test deltas with special characters.
  diffs = [[DIFF_EQUAL, '\u0680 \x00 \t %'], [DIFF_DELETE, '\u0681 \x01 \n ^'], [DIFF_INSERT, '\u0682 \x02 \\ |']]
  text1 = diffText1(diffs)
  expect(text1).toBe('\u0680 \x00 \t %\u0681 \x01 \n ^')

  delta = diffToDelta(diffs)
  expect(delta).toBe('=7\t-7\t+%DA%82 %02 %5C %7C')

  // Convert delta string into a diff.
  expect(diffFromDelta(text1, delta)).toEqual(diffs)

  // Verify pool of unchanged characters.
  diffs = [[DIFF_INSERT, 'A-Z a-z 0-9 - _ . ! ~ * \' ( ) ; / ? : @ & = + $ , # ']]
  const text2 = diffText2(diffs)
  expect(text2).toBe('A-Z a-z 0-9 - _ . ! ~ * \' ( ) ; / ? : @ & = + $ , # ')

  delta = diffToDelta(diffs)
  expect(delta).toBe('+A-Z a-z 0-9 - _ . ! ~ * \' ( ) ; / ? : @ & = + $ , # ')

  // Convert delta string into a diff.
  expect(diffFromDelta('', delta)).toEqual(diffs)

  // 160 kb string.
  let a = 'abcdefghij'
  for (let i = 0; i < 14; i++)
    a += a

  diffs = [[DIFF_INSERT, a]]
  delta = diffToDelta(diffs)
  expect(delta).toBe(`+${a}`)

  // Convert delta string into a diff.
  expect(diffFromDelta('', delta)).toEqual(diffs)
})

it('diffXIndex', () => {
  // Translate a location in text1 to text2.
  // Translation on equality.
  expect(diffXIndex([[DIFF_DELETE, 'a'], [DIFF_INSERT, '1234'], [DIFF_EQUAL, 'xyz']], 2)).toBe(5)

  // Translation on deletion.
  expect(diffXIndex([[DIFF_EQUAL, 'a'], [DIFF_DELETE, '1234'], [DIFF_EQUAL, 'xyz']], 3)).toBe(1)
})

it('diffLevenshtein', () => {
  // Levenshtein with trailing equality.
  expect(diffLevenshtein([[DIFF_DELETE, 'abc'], [DIFF_INSERT, '1234'], [DIFF_EQUAL, 'xyz']])).toBe(4)

  // Levenshtein with leading equality.
  expect(diffLevenshtein([[DIFF_EQUAL, 'xyz'], [DIFF_DELETE, 'abc'], [DIFF_INSERT, '1234']])).toBe(4)

  // Levenshtein with middle equality.
  expect(diffLevenshtein([[DIFF_DELETE, 'abc'], [DIFF_EQUAL, 'xyz'], [DIFF_INSERT, '1234']])).toBe(7)
})

it('diffBisect', () => {
  const options = resolveOptions({})
  // Normal.
  const a = 'cat'
  const b = 'map'
  // Since the resulting diff hasn't been normalized, it would be ok if
  // the insertion and deletion pairs are swapped.
  // If the order changes, tweak this test as required.
  expect(diffBisect(a, b, options, Number.MAX_VALUE)).toEqual([[DIFF_DELETE, 'c'], [DIFF_INSERT, 'm'], [DIFF_EQUAL, 'a'], [DIFF_DELETE, 't'], [DIFF_INSERT, 'p']])

  // Timeout.
  expect(diffBisect(a, b, options, 0)).toEqual([[DIFF_DELETE, 'cat'], [DIFF_INSERT, 'map']])
})

it('diffMain', () => {
  const options = resolveOptions({})

  // Perform a trivial diff.
  // Null case.
  expect(diffMain('', '', options)).toEqual([])

  // Equality.
  expect(diffMain('abc', 'abc', options)).toEqual([[DIFF_EQUAL, 'abc']])

  // Simple insertion.
  expect(diffMain('abc', 'ab123c', options)).toEqual([[DIFF_EQUAL, 'ab'], [DIFF_INSERT, '123'], [DIFF_EQUAL, 'c']])

  // Simple deletion.
  expect(diffMain('a123bc', 'abc', options)).toEqual([[DIFF_EQUAL, 'a'], [DIFF_DELETE, '123'], [DIFF_EQUAL, 'bc']])

  // Two insertions.
  expect(diffMain('abc', 'a123b456c', options)).toEqual([[DIFF_EQUAL, 'a'], [DIFF_INSERT, '123'], [DIFF_EQUAL, 'b'], [DIFF_INSERT, '456'], [DIFF_EQUAL, 'c']])

  // Two deletions.
  expect(diffMain('a123b456c', 'abc', options)).toEqual([[DIFF_EQUAL, 'a'], [DIFF_DELETE, '123'], [DIFF_EQUAL, 'b'], [DIFF_DELETE, '456'], [DIFF_EQUAL, 'c']])

  // Perform a real diff.
  // Switch off the timeout.
  options.diffTimeout = 0
  // Simple cases.
  expect(diffMain('a', 'b', options)).toEqual([[DIFF_DELETE, 'a'], [DIFF_INSERT, 'b']])

  expect(diffMain('Apples are a fruit.', 'Bananas are also fruit.', options)).toEqual([[DIFF_DELETE, 'Apple'], [DIFF_INSERT, 'Banana'], [DIFF_EQUAL, 's are a'], [DIFF_INSERT, 'lso'], [DIFF_EQUAL, ' fruit.']])

  expect(diffMain('ax\t', '\u0680x\0', options)).toEqual([[DIFF_DELETE, 'a'], [DIFF_INSERT, '\u0680'], [DIFF_EQUAL, 'x'], [DIFF_DELETE, '\t'], [DIFF_INSERT, '\0']])

  // Overlaps.
  expect(diffMain('1ayb2', 'abxab', options)).toEqual([[DIFF_DELETE, '1'], [DIFF_EQUAL, 'a'], [DIFF_DELETE, 'y'], [DIFF_EQUAL, 'b'], [DIFF_DELETE, '2'], [DIFF_INSERT, 'xab']])

  expect(diffMain('abcy', 'xaxcxabc', options)).toEqual([[DIFF_INSERT, 'xaxcx'], [DIFF_EQUAL, 'abc'], [DIFF_DELETE, 'y']])

  expect(diffMain('ABCDa=bcd=efghijklmnopqrsEFGHIJKLMNOefg', 'a-bcd-efghijklmnopqrs', options)).toEqual([[DIFF_DELETE, 'ABCD'], [DIFF_EQUAL, 'a'], [DIFF_DELETE, '='], [DIFF_INSERT, '-'], [DIFF_EQUAL, 'bcd'], [DIFF_DELETE, '='], [DIFF_INSERT, '-'], [DIFF_EQUAL, 'efghijklmnopqrs'], [DIFF_DELETE, 'EFGHIJKLMNOefg']])

  // Large equality.
  expect(diffMain('a [[Pennsylvania]] and [[New', ' and [[Pennsylvania]]', options)).toEqual([[DIFF_INSERT, ' '], [DIFF_EQUAL, 'a'], [DIFF_INSERT, 'nd'], [DIFF_EQUAL, ' [[Pennsylvania]]'], [DIFF_DELETE, ' and [[New']])

  // Timeout.
  options.diffTimeout = 0.1 // 100ms
  let a = '`Twas brillig, and the slithy toves\nDid gyre and gimble in the wabe:\nAll mimsy were the borogoves,\nAnd the mome raths outgrabe.\n'
  let b = 'I am the very model of a modern major general,\nI\'ve information vegetable, animal, and mineral,\nI know the kings of England, and I quote the fights historical,\nFrom Marathon to Waterloo, in order categorical.\n'
  // Increase the text lengths by 1024 times to ensure a timeout.
  for (let i = 0; i < 10; i++) {
    a += a
    b += b
  }
  const startTime = (new Date()).getTime()
  diffMain(a, b, options)
  const endTime = (new Date()).getTime()
  // Test that we took at least the timeout period.
  expect(options.diffTimeout * 1000 <= endTime - startTime).toBe(true)
  // Test that we didn't take forever (be forgiving).
  // Theoretically this test could fail very occasionally if the
  // OS task swaps or locks up for a second at the wrong moment.
  expect(options.diffTimeout * 1000 * 2 > endTime - startTime).toBe(true)
  options.diffTimeout = 0

  // Test the linemode speedup.
  // Must be long to pass the 100 char cutoff.
  // Simple line-mode.
  a = '1234567890\n1234567890\n1234567890\n1234567890\n1234567890\n1234567890\n1234567890\n1234567890\n1234567890\n1234567890\n1234567890\n1234567890\n1234567890\n'
  b = 'abcdefghij\nabcdefghij\nabcdefghij\nabcdefghij\nabcdefghij\nabcdefghij\nabcdefghij\nabcdefghij\nabcdefghij\nabcdefghij\nabcdefghij\nabcdefghij\nabcdefghij\n'
  expect(diffMain(a, b, options, false))
    .toEqual(diffMain(a, b, options, true))

  // Single line-mode.
  a = '1234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890'
  b = 'abcdefghijabcdefghijabcdefghijabcdefghijabcdefghijabcdefghijabcdefghijabcdefghijabcdefghijabcdefghijabcdefghijabcdefghijabcdefghij'
  expect(diffMain(a, b, options, false))
    .toEqual(diffMain(a, b, options, true))

  // Overlap line-mode.
  a = '1234567890\n1234567890\n1234567890\n1234567890\n1234567890\n1234567890\n1234567890\n1234567890\n1234567890\n1234567890\n1234567890\n1234567890\n1234567890\n'
  b = 'abcdefghij\n1234567890\n1234567890\n1234567890\nabcdefghij\n1234567890\n1234567890\n1234567890\nabcdefghij\n1234567890\n1234567890\n1234567890\nabcdefghij\n'
  const texts_linemode = diffRebuildTexts(diffMain(a, b, options, true))
  const texts_textmode = diffRebuildTexts(diffMain(a, b, options, false))
  expect(texts_linemode).toEqual(texts_textmode)

  // Test null inputs.
  expect(() => diffMain(null as any, null as any, options))
    .toThrowErrorMatchingInlineSnapshot(`[Error: Null input. (diff_main)]`)
})
