import { expect, it } from 'vitest'
import {
  DIFF_DELETE,
  DIFF_EQUAL,
  DIFF_INSERT,
  diffMain,
} from '../src/diff'
import {
  resolveOptions,
} from '../src/options'
import {
  createPatch,
  patchAddContext,
  patchAddPadding,
  patchApply,
  patchFromText,
  patchMake,
  patchSplitMax,
  patchToText,
} from '../src/patch'

it('patchObj', () => {
  // Patch Object.
  const p = createPatch()
  p.start1 = 20
  p.start2 = 21
  p.length1 = 18
  p.length2 = 17
  p.diffs = [[DIFF_EQUAL, 'jump'], [DIFF_DELETE, 's'], [DIFF_INSERT, 'ed'], [DIFF_EQUAL, ' over '], [DIFF_DELETE, 'the'], [DIFF_INSERT, 'a'], [DIFF_EQUAL, '\nlaz']]
  const strp = p.toString()
  expect(strp).toBe('@@ -21,18 +22,17 @@\n jump\n-s\n+ed\n  over \n-the\n+a\n %0Alaz\n')
})

it('patchFromText', () => {
  expect(patchFromText('')).toEqual([])

  const strp = '@@ -21,18 +22,17 @@\n jump\n-s\n+ed\n  over \n-the\n+a\n %0Alaz\n'
  expect(patchFromText(strp)[0].toString()).toBe(strp)

  expect(patchFromText('@@ -1 +1 @@\n-a\n+b\n')[0].toString()).toBe('@@ -1 +1 @@\n-a\n+b\n')

  expect(patchFromText('@@ -1,3 +0,0 @@\n-abc\n')[0].toString()).toBe('@@ -1,3 +0,0 @@\n-abc\n')

  expect(patchFromText('@@ -0,0 +1,3 @@\n+abc\n')[0].toString()).toBe('@@ -0,0 +1,3 @@\n+abc\n')

  // Generates error.
  expect(() => patchFromText('Bad\nPatch\n'))
    .toThrowErrorMatchingInlineSnapshot(`[Error: Invalid patch string: Bad]`)
})

it('patchToText', () => {
  let strp = '@@ -21,18 +22,17 @@\n jump\n-s\n+ed\n  over \n-the\n+a\n  laz\n'
  let p = patchFromText(strp)
  expect(patchToText(p)).toBe(strp)

  strp = '@@ -1,9 +1,9 @@\n-f\n+F\n oo+fooba\n@@ -7,9 +7,9 @@\n obar\n-,\n+.\n  tes\n'
  p = patchFromText(strp)
  expect(patchToText(p)).toBe(strp)
})

it('patchAddContext', () => {
  const options = resolveOptions({})

  options.patchMargin = 4
  let p = patchFromText('@@ -21,4 +21,10 @@\n-jump\n+somersault\n')[0]
  patchAddContext(p, 'The quick brown fox jumps over the lazy dog.', options)
  expect(p.toString()).toBe('@@ -17,12 +17,18 @@\n fox \n-jump\n+somersault\n s ov\n')

  // Same, but not enough trailing context.
  p = patchFromText('@@ -21,4 +21,10 @@\n-jump\n+somersault\n')[0]
  patchAddContext(p, 'The quick brown fox jumps.', options)
  expect(p.toString()).toBe('@@ -17,10 +17,16 @@\n fox \n-jump\n+somersault\n s.\n')

  // Same, but not enough leading context.
  p = patchFromText('@@ -3 +3,2 @@\n-e\n+at\n')[0]
  patchAddContext(p, 'The quick brown fox jumps.', options)
  expect(p.toString()).toBe('@@ -1,7 +1,8 @@\n Th\n-e\n+at\n  qui\n')

  // Same, but with ambiguity.
  p = patchFromText('@@ -3 +3,2 @@\n-e\n+at\n')[0]
  patchAddContext(p, 'The quick brown fox jumps.  The quick brown fox crashes.', options)
  expect(p.toString()).toBe('@@ -1,27 +1,28 @@\n Th\n-e\n+at\n  quick brown fox jumps. \n')
})

it('patchMake', () => {
  const options = resolveOptions({})

  // Null case.
  let patches = patchMake('', '', undefined, options)
  expect(patchToText(patches)).toBe('')

  let text1 = 'The quick brown fox jumps over the lazy dog.'
  let text2 = 'That quick brown fox jumped over a lazy dog.'
  // Text2+Text1 inputs.
  let expectedPatch = '@@ -1,8 +1,7 @@\n Th\n-at\n+e\n  qui\n@@ -21,17 +21,18 @@\n jump\n-ed\n+s\n  over \n-a\n+the\n  laz\n'
  // The second patch must be "-21,17 +21,18", not "-22,17 +21,18" due to rolling context.
  patches = patchMake(text2, text1, undefined, options)
  expect(patchToText(patches)).toBe(expectedPatch)

  // Text1+Text2 inputs.
  expectedPatch = '@@ -1,11 +1,12 @@\n Th\n-e\n+at\n  quick b\n@@ -22,18 +22,17 @@\n jump\n-s\n+ed\n  over \n-the\n+a\n  laz\n'
  patches = patchMake(text1, text2, undefined, options)
  expect(patchToText(patches)).toBe(expectedPatch)

  // Diff input.
  let diffs = diffMain(text1, text2, options)
  patches = patchMake(diffs, undefined, undefined, options)
  expect(patchToText(patches)).toBe(expectedPatch)

  // Text1+Diff inputs.
  patches = patchMake(text1, diffs, undefined, options)
  expect(patchToText(patches)).toBe(expectedPatch)

  // Text1+Text2+Diff inputs (deprecated).
  patches = patchMake(text1, text2, diffs, options)
  expect(patchToText(patches)).toBe(expectedPatch)

  // Character encoding.
  patches = patchMake('`1234567890-=[]\\;\',./', '~!@#$%^&*()_+{}|:"<>?')
  expect(patchToText(patches)).toBe('@@ -1,21 +1,21 @@\n-%601234567890-=%5B%5D%5C;\',./\n+~!@#$%25%5E&*()_+%7B%7D%7C:%22%3C%3E?\n')

  // Character decoding.
  diffs = [[DIFF_DELETE, '`1234567890-=[]\\;\',./'], [DIFF_INSERT, '~!@#$%^&*()_+{}|:"<>?']]
  expect(patches[0].diffs).toEqual(diffs)

  // Long string with repeats.
  text1 = ''
  for (let x = 0; x < 100; x++)
    text1 += 'abcdef'

  text2 = `${text1}123`
  expectedPatch = '@@ -573,28 +573,31 @@\n cdefabcdefabcdefabcdefabcdef\n+123\n'
  patches = patchMake(text1, text2, undefined, options)
  expect(patchToText(patches)).toBe(expectedPatch)

  // Test null inputs.
  expect(() => patchMake(null as any))
    .toThrowErrorMatchingInlineSnapshot(`[Error: Unknown call format to patch_make.]`)
})

it('patchSplitMax', () => {
  const options = resolveOptions({})

  // Assumes that dmp.Match_MaxBits is 32.
  let patches = patchMake('abcdefghijklmnopqrstuvwxyz01234567890', 'XabXcdXefXghXijXklXmnXopXqrXstXuvXwxXyzX01X23X45X67X89X0')
  patchSplitMax(patches, options)
  expect(patchToText(patches)).toBe('@@ -1,32 +1,46 @@\n+X\n ab\n+X\n cd\n+X\n ef\n+X\n gh\n+X\n ij\n+X\n kl\n+X\n mn\n+X\n op\n+X\n qr\n+X\n st\n+X\n uv\n+X\n wx\n+X\n yz\n+X\n 012345\n@@ -25,13 +39,18 @@\n zX01\n+X\n 23\n+X\n 45\n+X\n 67\n+X\n 89\n+X\n 0\n')

  patches = patchMake('abcdef1234567890123456789012345678901234567890123456789012345678901234567890uvwxyz', 'abcdefuvwxyz')
  const oldToText = patchToText(patches)
  patchSplitMax(patches, options)
  expect(patchToText(patches)).toBe(oldToText)

  patches = patchMake('1234567890123456789012345678901234567890123456789012345678901234567890', 'abc')
  patchSplitMax(patches, options)
  expect(patchToText(patches)).toBe('@@ -1,32 +1,4 @@\n-1234567890123456789012345678\n 9012\n@@ -29,32 +1,4 @@\n-9012345678901234567890123456\n 7890\n@@ -57,14 +1,3 @@\n-78901234567890\n+abc\n')

  patches = patchMake('abcdefghij , h : 0 , t : 1 abcdefghij , h : 0 , t : 1 abcdefghij , h : 0 , t : 1', 'abcdefghij , h : 1 , t : 1 abcdefghij , h : 1 , t : 1 abcdefghij , h : 0 , t : 1')
  patchSplitMax(patches, options)
  expect(patchToText(patches)).toBe('@@ -2,32 +2,32 @@\n bcdefghij , h : \n-0\n+1\n  , t : 1 abcdef\n@@ -29,32 +29,32 @@\n bcdefghij , h : \n-0\n+1\n  , t : 1 abcdef\n')
})

it('patchAddPadding', () => {
  const options = resolveOptions({})

  // Both edges full.
  let patches = patchMake('', 'test')
  expect(patchToText(patches)).toBe('@@ -0,0 +1,4 @@\n+test\n')
  patchAddPadding(patches, options)
  expect(patchToText(patches)).toBe('@@ -1,8 +1,12 @@\n %01%02%03%04\n+test\n %01%02%03%04\n')

  // Both edges partial.
  patches = patchMake('XY', 'XtestY')
  expect(patchToText(patches)).toBe('@@ -1,2 +1,6 @@\n X\n+test\n Y\n')
  patchAddPadding(patches, options)
  expect(patchToText(patches)).toBe('@@ -2,8 +2,12 @@\n %02%03%04X\n+test\n Y%01%02%03\n')

  // Both edges none.
  patches = patchMake('XXXXYYYY', 'XXXXtestYYYY')
  expect(patchToText(patches)).toBe('@@ -1,8 +1,12 @@\n XXXX\n+test\n YYYY\n')
  patchAddPadding(patches, options)
  expect(patchToText(patches)).toBe('@@ -5,8 +5,12 @@\n XXXX\n+test\n YYYY\n')
})

it('patchApply', () => {
  const options = resolveOptions({
    matchDistance: 1000,
    matchThreshold: 0.5,
    patchDeleteThreshold: 0.5,
  })

  // Null case.
  let patches = patchMake('', '')
  let results = patchApply(patches, 'Hello world.', options)
  expect(results).toEqual(['Hello world.', []])

  // Exact match.
  patches = patchMake('The quick brown fox jumps over the lazy dog.', 'That quick brown fox jumped over a lazy dog.')
  results = patchApply(patches, 'The quick brown fox jumps over the lazy dog.', options)
  expect(results).toEqual(['That quick brown fox jumped over a lazy dog.', [true, true]])

  // Partial match.
  results = patchApply(patches, 'The quick red rabbit jumps over the tired tiger.', options)
  expect(results).toEqual(['That quick red rabbit jumped over a tired tiger.', [true, true]])

  // Failed match.
  results = patchApply(patches, 'I am the very model of a modern major general.', options)
  expect(results).toEqual(['I am the very model of a modern major general.', [false, false]])

  // Big delete, small change.
  patches = patchMake('x1234567890123456789012345678901234567890123456789012345678901234567890y', 'xabcy')
  results = patchApply(patches, 'x123456789012345678901234567890-----++++++++++-----123456789012345678901234567890y', options)
  expect(results).toEqual(['xabcy', [true, true]])

  // Big delete, big change 1.
  patches = patchMake('x1234567890123456789012345678901234567890123456789012345678901234567890y', 'xabcy')
  results = patchApply(patches, 'x12345678901234567890---------------++++++++++---------------12345678901234567890y', options)
  expect(results).toEqual(['xabc12345678901234567890---------------++++++++++---------------12345678901234567890y', [false, true]])

  // Big delete, big change 2.
  options.patchDeleteThreshold = 0.6
  patches = patchMake('x1234567890123456789012345678901234567890123456789012345678901234567890y', 'xabcy')
  results = patchApply(patches, 'x12345678901234567890---------------++++++++++---------------12345678901234567890y', options)
  expect(results).toEqual(['xabcy', [true, true]])
  options.patchDeleteThreshold = 0.5

  // Compensate for failed patch.
  options.matchThreshold = 0.0
  options.matchDistance = 0
  patches = patchMake('abcdefghijklmnopqrstuvwxyz--------------------1234567890', 'abcXXXXXXXXXXdefghijklmnopqrstuvwxyz--------------------1234567YYYYYYYYYY890')
  results = patchApply(patches, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ--------------------1234567890', options)
  expect(results).toEqual(['ABCDEFGHIJKLMNOPQRSTUVWXYZ--------------------1234567YYYYYYYYYY890', [false, true]])
  options.matchThreshold = 0.5
  options.matchDistance = 1000

  // No side effects.
  patches = patchMake('', 'test')
  let patchstr = patchToText(patches)
  patchApply(patches, '', options)
  expect(patchToText(patches)).toBe(patchstr)

  // No side effects with major delete.
  patches = patchMake('The quick brown fox jumps over the lazy dog.', 'Woof')
  patchstr = patchToText(patches)
  patchApply(patches, 'The quick brown fox jumps over the lazy dog.', options)
  expect(patchToText(patches)).toBe(patchstr)

  // Edge exact match.
  patches = patchMake('', 'test')
  results = patchApply(patches, '', options)
  expect(results).toEqual(['test', [true]])

  // Near edge exact match.
  patches = patchMake('XY', 'XtestY')
  results = patchApply(patches, 'XY', options)
  expect(results).toEqual(['XtestY', [true]])

  // Edge partial match.
  patches = patchMake('y', 'y123')
  results = patchApply(patches, 'x', options)
  expect(results).toEqual(['x123', [true]])
})
